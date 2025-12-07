const gridElement = document.getElementById('grid');
const mineCountElement = document.getElementById('mine-count');
const timerElement = document.getElementById('timer');
const resetBtn = document.getElementById('reset-btn');
const difficultySelect = document.getElementById('difficulty');
const hintBtn = document.getElementById('hint-btn');
const solveBtn = document.getElementById('solve-btn');

// Modal Elements
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalTime = document.getElementById('modal-time');
const modalRestartBtn = document.getElementById('modal-restart-btn');

const DIFFICULTIES = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 }
};

let currentConfig = DIFFICULTIES.easy;
let board = [];
let isGameOver = false;
let flags = 0;
let timer = 0;
let timerInterval = null;
let firstClick = true;

function updateGridCSS() {
    const root = document.documentElement;
    root.style.setProperty('--rows', currentConfig.rows);
    root.style.setProperty('--cols', currentConfig.cols);
}

function initGame() {
    const diffKey = difficultySelect.value;
    currentConfig = DIFFICULTIES[diffKey];
    updateGridCSS();

    clearInterval(timerInterval);
    timer = 0;
    flags = 0;
    isGameOver = false;
    firstClick = true;
    board = [];
    
    timerElement.innerText = '000';
    mineCountElement.innerText = formatNumber(currentConfig.mines);
    resetBtn.innerText = '😊';
    modalOverlay.classList.add('hidden');
    gridElement.innerHTML = '';
    
    for (let r = 0; r < currentConfig.rows; r++) {
        const row = [];
        for (let c = 0; c < currentConfig.cols; c++) {
            const cellData = {
                r,
                c,
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0,
                element: null
            };
            
            const cellEl = document.createElement('div');
            cellEl.classList.add('cell');
            cellEl.addEventListener('click', () => handleClick(cellData));
            cellEl.addEventListener('contextmenu', (e) => handleRightClick(e, cellData));
            cellEl.addEventListener('mousedown', (e) => { 
                if(!isGameOver && e.button === 0) resetBtn.innerText = '😮'; 
            });
            cellEl.addEventListener('mouseup', () => { 
                if(!isGameOver) resetBtn.innerText = '😊'; 
            });
            cellEl.addEventListener('mouseleave', () => {
                 if(!isGameOver) resetBtn.innerText = '😊'; 
            });
            
            gridElement.appendChild(cellEl);
            cellData.element = cellEl;
            row.push(cellData);
        }
        board.push(row);
    }
}

function formatNumber(num) {
    return Math.max(0, num).toString().padStart(3, '0');
}

function placeMines(safeRow, safeCol) {
    let minesPlaced = 0;
    const { rows, cols, mines } = currentConfig;

    while (minesPlaced < mines) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);

        if (!board[r][c].isMine) {
            if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) {
                continue;
            }
            board[r][c].isMine = true;
            minesPlaced++;
        }
    }
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!board[r][c].isMine) {
                let count = 0;
                getNeighbors(r, c).forEach(n => {
                    if (n.isMine) count++;
                });
                board[r][c].neighborMines = count;
            }
        }
    }
}

function getNeighbors(r, c) {
    const neighbors = [];
    const { rows, cols } = currentConfig;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const nr = r + i;
            const nc = c + j;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                neighbors.push(board[nr][nc]);
            }
        }
    }
    return neighbors;
}

function startTimer() {
    timerInterval = setInterval(() => {
        timer++;
        timerElement.innerText = formatNumber(Math.min(timer, 999));
    }, 1000);
}

// 處理左鍵點擊
function handleClick(cell) {
    if (isGameOver || cell.isRevealed || cell.isFlagged) return;

    // 第一次點擊時才放置地雷，並確保產生可解版面
    if (firstClick) {
        firstClick = false;
        // 使用嘗試驗證法生成無死角版面
        if (!generateSolvableBoard(cell.r, cell.c)) {
            // 如果嘗試太多次都失敗（極低機率），回退到普通隨機
            console.warn("無法生成完美邏輯版面，使用隨機版面");
            placeMines(cell.r, cell.c); 
            startTimer();
        } else {
            console.log("成功生成無猜測版面！");
            startTimer();
        }
    }

    if (cell.isMine) {
        gameOver(false);
    } else {
        revealCell(cell);
        checkWin();
    }
}

// -----------------------------------------------------
// 保證可解版面生成器 (No-Guess Generator)
// -----------------------------------------------------

function generateSolvableBoard(safeR, safeC) {
    const maxAttempts = 500; // 最大嘗試次數，避免瀏覽器卡死
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // 1. 清除舊的地雷
        resetMines();
        
        // 2. 隨機放置地雷
        placeMines(safeR, safeC);
        
        // 3. 在虛擬環境中測試是否可解
        if (checkSolvability(safeR, safeC)) {
            return true; // 找到完美版面！
        }
    }
    return false; // 嘗試失敗
}

function resetMines() {
    for (let r = 0; r < currentConfig.rows; r++) {
        for (let c = 0; c < currentConfig.cols; c++) {
            board[r][c].isMine = false;
            board[r][c].neighborMines = 0;
        }
    }
}

// 虛擬解題模擬器
function checkSolvability(startR, startC) {
    // 建立一個簡化的虛擬版面狀態，避免影響 UI
    // 狀態: 0=未開, 1=已開, 2=插旗
    const vBoard = []; 
    const { rows, cols } = currentConfig;
    let revealedCount = 0;
    const totalSafeCells = (rows * cols) - currentConfig.mines;

    for(let r=0; r<rows; r++) {
        const row = [];
        for(let c=0; c<cols; c++) {
            row.push({
                r, c,
                isMine: board[r][c].isMine,
                neighborMines: board[r][c].neighborMines,
                state: 0 // 0: unrevealed, 1: revealed, 2: flagged
            });
        }
        vBoard.push(row);
    }

    // 模擬揭開第一格 (會觸發 Flood Fill)
    const queue = [vBoard[startR][startC]];
    
    // 簡單的 Flood Fill 模擬
    function virtualReveal(cell) {
        if (cell.state !== 0) return;
        cell.state = 1;
        revealedCount++;
        
        if (cell.neighborMines === 0) {
            getVirtualNeighbors(vBoard, cell.r, cell.c).forEach(n => {
                if (n.state === 0) virtualReveal(n);
            });
        }
    }
    virtualReveal(vBoard[startR][startC]);

    // 邏輯迴圈
    let changed = true;
    while (changed) {
        changed = false;
        
        // 1. Basic Single Cell Logic
        for(let r=0; r<rows; r++) {
            for(let c=0; c<cols; c++) {
                const cell = vBoard[r][c];
                if (cell.state !== 1 || cell.neighborMines === 0) continue;

                const neighbors = getVirtualNeighbors(vBoard, r, c);
                const unrevealed = neighbors.filter(n => n.state === 0);
                const flagged = neighbors.filter(n => n.state === 2);
                
                // 規則 1: 定雷
                if (unrevealed.length > 0 && unrevealed.length === cell.neighborMines - flagged.length) {
                    unrevealed.forEach(n => { n.state = 2; changed = true; });
                }

                // 規則 2: 排雷
                if (unrevealed.length > 0 && flagged.length === cell.neighborMines) {
                    unrevealed.forEach(n => { virtualReveal(n); changed = true; });
                }
            }
        }

        if (changed) continue; 

        // 2. Advanced Set Logic (Only if basic stuck)
        for(let r1=0; r1<rows; r1++) {
            for(let c1=0; c1<cols; c1++) {
                const cellA = vBoard[r1][c1];
                if (cellA.state !== 1 || cellA.neighborMines === 0) continue;

                const neighborsA = getVirtualNeighbors(vBoard, r1, c1);
                const unrevealedA = neighborsA.filter(n => n.state === 0);
                const flaggedA = neighborsA.filter(n => n.state === 2);
                const minesNeededA = cellA.neighborMines - flaggedA.length;
                
                if (unrevealedA.length === 0) continue;

                for (let i = -2; i <= 2; i++) {
                    for (let j = -2; j <= 2; j++) {
                        if (i === 0 && j === 0) continue;
                        const r2 = r1 + i, c2 = c1 + j;
                        if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
                        
                        const cellB = vBoard[r2][c2];
                        if (cellB.state !== 1 || cellB.neighborMines === 0) continue;

                        const neighborsB = getVirtualNeighbors(vBoard, r2, c2);
                        const unrevealedB = neighborsB.filter(n => n.state === 0);
                        const flaggedB = neighborsB.filter(n => n.state === 2);
                        const minesNeededB = cellB.neighborMines - flaggedB.length;

                        if (unrevealedB.length === 0) continue;

                        const isSubset = unrevealedA.every(uA => unrevealedB.some(uB => uB.r === uA.r && uB.c === uA.c));
                        
                        if (isSubset) {
                            const diff = unrevealedB.filter(uB => !unrevealedA.some(uA => uA.r === uB.r && uA.c === uB.c));
                            if (diff.length === 0) continue;

                            if (minesNeededA === minesNeededB) {
                                diff.forEach(target => {
                                    if(target.state === 0) { virtualReveal(target); changed = true; }
                                });
                            }

                            if (minesNeededB - minesNeededA === diff.length) {
                                diff.forEach(target => {
                                    if(target.state === 0) { target.state = 2; changed = true; }
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // 如果解開的格子數等於所有安全格，代表可解
    return revealedCount === totalSafeCells;
}

function getVirtualNeighbors(vBoard, r, c) {
    const neighbors = [];
    const { rows, cols } = currentConfig;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const nr = r + i;
            const nc = c + j;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                neighbors.push(vBoard[nr][nc]);
            }
        }
    }
    return neighbors;
}

// 處理右鍵點擊 (插旗)
function handleRightClick(e, cell) {
    if(e) e.preventDefault();
    if (isGameOver || cell.isRevealed) return;

    if (cell.isFlagged) {
        cell.isFlagged = false;
        cell.element.classList.remove('flagged');
        cell.element.innerText = '';
        flags--;
    } else {
        cell.isFlagged = true;
        cell.element.classList.add('flagged');
        cell.element.innerText = '🚩';
        flags++;
    }
    mineCountElement.innerText = formatNumber(currentConfig.mines - flags);
}

function revealCell(cell) {
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;
    cell.element.classList.add('revealed');

    if (cell.neighborMines > 0) {
        cell.element.innerText = cell.neighborMines;
        cell.element.setAttribute('data-num', cell.neighborMines);
    } else {
        const neighbors = getNeighbors(cell.r, cell.c);
        neighbors.forEach(neighbor => revealCell(neighbor));
    }
}

function gameOver(isWin) {
    isGameOver = true;
    clearInterval(timerInterval);

    if (isWin) {
        resetBtn.innerText = '😎';
        board.flat().forEach(cell => {
            if (cell.isMine && !cell.isFlagged) {
                cell.element.innerText = '🚩';
                cell.element.classList.add('flagged');
            }
        });
        showModal(true);
    } else {
        resetBtn.innerText = '😵';
        board.flat().forEach(cell => {
            if (cell.isMine) {
                cell.element.classList.add('revealed', 'mine');
                cell.element.innerText = '💣';
            }
        });
        setTimeout(() => showModal(false), 500);
    }
}

function showModal(isWin) {
    modalOverlay.classList.remove('hidden');
    modalTime.innerText = timer;
    if (isWin) {
        modalTitle.innerText = "恭喜獲勝！🎉";
        modalMessage.innerText = `你成功避開了所有地雷！`;
        modalTitle.style.color = "green";
    } else {
        modalTitle.innerText = "遊戲結束 💥";
        modalMessage.innerText = "你踩到了地雷！";
        modalTitle.style.color = "red";
    }
}

function checkWin() {
    let revealedCount = 0;
    board.flat().forEach(cell => {
        if (cell.isRevealed) revealedCount++;
    });

    if (revealedCount === (currentConfig.rows * currentConfig.cols) - currentConfig.mines) {
        gameOver(true);
    }
}

// -----------------------------------------------------
// 邏輯推導核心 (Solver Logic)
// -----------------------------------------------------

// 獲取所有邏輯上確定的下一步動作
// 返回格式: Array of { cell: CellObject, action: 'reveal' | 'flag' }
function getLogicMoves() {
    const moves = [];
    const processed = new Set(); 

    // 1. 基礎單格邏輯 (Basic Single Cell)
    for (let r = 0; r < currentConfig.rows; r++) {
        for (let c = 0; c < currentConfig.cols; c++) {
            const cell = board[r][c];
            if (!cell.isRevealed || cell.neighborMines === 0) continue;

            const neighbors = getNeighbors(r, c);
            const unrevealed = neighbors.filter(n => !n.isRevealed);
            const flagged = neighbors.filter(n => n.isFlagged);
            const unrevealedNonFlagged = unrevealed.filter(n => !n.isFlagged);
            
            const remainingMines = cell.neighborMines - flagged.length;

            // 規則 1: 定雷
            if (unrevealedNonFlagged.length > 0 && unrevealedNonFlagged.length === remainingMines) {
                unrevealedNonFlagged.forEach(target => {
                    const key = `flag-${target.r},${target.c}`;
                    if (!processed.has(key)) {
                        moves.push({ cell: target, action: 'flag' });
                        processed.add(key);
                    }
                });
            }

            // 規則 2: 排雷
            if (unrevealedNonFlagged.length > 0 && remainingMines === 0) {
                unrevealedNonFlagged.forEach(target => {
                    const key = `reveal-${target.r},${target.c}`;
                    if (!processed.has(key)) {
                        moves.push({ cell: target, action: 'reveal' });
                        processed.add(key);
                    }
                });
            }
        }
    }

    // 2. 進階集合邏輯 (Advanced Set Logic / 1-2-1 Pattern)
    // 比較兩個數字格 A 和 B，如果 A 的未知鄰居是 B 的未知鄰居的子集 (Subset)
    for (let r1 = 0; r1 < currentConfig.rows; r1++) {
        for (let c1 = 0; c1 < currentConfig.cols; c1++) {
            const cellA = board[r1][c1];
            if (!cellA.isRevealed || cellA.neighborMines === 0) continue;

            const neighborsA = getNeighbors(r1, c1);
            const unrevealedA = neighborsA.filter(n => !n.isRevealed && !n.isFlagged);
            const flaggedA = neighborsA.filter(n => n.isFlagged);
            const minesNeededA = cellA.neighborMines - flaggedA.length;
            
            if (unrevealedA.length === 0) continue;

            // 尋找鄰近的另一個數字格 B (通常在 2 格範圍內有效)
            for (let i = -2; i <= 2; i++) {
                for (let j = -2; j <= 2; j++) {
                    if (i === 0 && j === 0) continue;
                    const r2 = r1 + i, c2 = c1 + j;
                    if (r2 < 0 || r2 >= currentConfig.rows || c2 < 0 || c2 >= currentConfig.cols) continue;
                    
                    const cellB = board[r2][c2];
                    if (!cellB.isRevealed || cellB.neighborMines === 0) continue;

                    const neighborsB = getNeighbors(r2, c2);
                    const unrevealedB = neighborsB.filter(n => !n.isRevealed && !n.isFlagged);
                    const flaggedB = neighborsB.filter(n => n.isFlagged);
                    const minesNeededB = cellB.neighborMines - flaggedB.length;

                    if (unrevealedB.length === 0) continue;

                    // 檢查 A 是否為 B 的子集 (A ⊆ B)
                    // 即 A 的所有未知格都在 B 的未知格列表中
                    const isSubset = unrevealedA.every(uA => unrevealedB.some(uB => uB.r === uA.r && uB.c === uA.c));
                    
                    if (isSubset) {
                        const diff = unrevealedB.filter(uB => !unrevealedA.some(uA => uA.r === uB.r && uA.c === uB.c));
                        if (diff.length === 0) continue;

                        // 邏輯 3: 差集安全 (Subtractive Safety)
                        // 如果 A 和 B 需要的地雷數一樣，且 A ⊆ B
                        // 那麼 B 多出來的那些格子 (B - A) 必定是安全的
                        if (minesNeededA === minesNeededB) {
                            diff.forEach(target => {
                                const key = `reveal-${target.r},${target.c}`;
                                if (!processed.has(key)) {
                                    moves.push({ cell: target, action: 'reveal' });
                                    processed.add(key);
                                }
                            });
                        }

                        // 邏輯 4: 差集定雷 (Subtractive Mines)
                        // 如果 (B需要的雷 - A需要的雷) 剛好等於 (B多出來的格子數)
                        // 那麼 B 多出來的那些格子必定全是雷
                        if (minesNeededB - minesNeededA === diff.length) {
                            diff.forEach(target => {
                                const key = `flag-${target.r},${target.c}`;
                                if (!processed.has(key)) {
                                    moves.push({ cell: target, action: 'flag' });
                                    processed.add(key);
                                }
                            });
                        }
                    }
                }
            }
        }
    }

    return moves;
}

// 提示功能：只執行一步，並閃爍提示
function handleHint() {
    if (isGameOver) return;
    
    // 如果是第一步，還沒開局，提示中間
    if (firstClick) {
        const centerR = Math.floor(currentConfig.rows / 2);
        const centerC = Math.floor(currentConfig.cols / 2);
        highlightCell(board[centerR][centerC]);
        return;
    }

    const moves = getLogicMoves();
    if (moves.length > 0) {
        // 優先提示「點開」的動作，因為比較有進展感
        const safeMove = moves.find(m => m.action === 'reveal');
        const targetMove = safeMove || moves[0];
        
        highlightCell(targetMove.cell);
        // 如果想直接顯示文字提示，可以在這裡 console.log
    } else {
        alert("目前無法用基礎邏輯推導，可能需要猜測！");
    }
}

function highlightCell(cell) {
    cell.element.classList.add('highlighted');
    setTimeout(() => {
        cell.element.classList.remove('highlighted');
    }, 1500);
}

// 自動解題功能：循環執行
async function handleAutoSolve() {
    if (isGameOver) return;
    
    if (firstClick) {
        // 第一步先點中間
        const centerR = Math.floor(currentConfig.rows / 2);
        const centerC = Math.floor(currentConfig.cols / 2);
        handleClick(board[centerR][centerC]);
        await new Promise(r => setTimeout(r, 100)); 
    }

    let hasMoves = true;
    while (hasMoves && !isGameOver) {
        const moves = getLogicMoves();
        if (moves.length === 0) {
            hasMoves = false;
            // 如果沒步了但還沒結束，提示需要猜
            break;
        }

        // 逐一執行步驟，每步之間暫停
        for (const move of moves) {
            if (isGameOver) break; // 防止在執行過程中遊戲結束

            if (move.action === 'flag') {
                if (!move.cell.isFlagged) {
                    handleRightClick(null, move.cell);
                }
            } else if (move.action === 'reveal') {
                if (!move.cell.isRevealed) {
                    handleClick(move.cell);
                }
            }
            
            // 每次點擊/插旗後等待 0.1 秒
            await new Promise(r => setTimeout(r, 10)); 
        }
        
        // 批次之間的額外檢查，確保狀態更新
        // 這裡不需要額外等待，因為迴圈內已經等過了，
        // 但如果 moves 為空就會自動跳出 while
    }
}


resetBtn.addEventListener('click', initGame);
difficultySelect.addEventListener('change', initGame);
modalRestartBtn.addEventListener('click', initGame);
hintBtn.addEventListener('click', handleHint);
solveBtn.addEventListener('click', handleAutoSolve);

initGame();
