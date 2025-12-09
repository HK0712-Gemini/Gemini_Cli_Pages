const calendarContainer = document.getElementById('calendar');
const modal = document.getElementById('modal');
const modalDay = document.getElementById('modal-day');
const modalImage = document.getElementById('modal-image');
const modalMessage = document.getElementById('modal-message');
const closeBtn = document.querySelector('.close-btn');
const resetBtn = document.getElementById('reset-btn');

// 24 Days of Surprise Data (English)
const adventData = [
    { day: 1, icon: "🕯️", message: "Advent begins! Light the first candle and make a wish." },
    { day: 2, icon: "❄️", message: "It's getting chilly. Wear an extra layer or go play in the snow!" },
    { day: 3, icon: "🍪", message: "Bake some gingerbread men. The house will smell amazing." },
    { day: 4, icon: "☕", message: "Have a cup of hot cocoa with extra marshmallows." },
    { day: 5, icon: "🧦", message: "Hang up your stockings and wait for Santa!" },
    { day: 6, icon: "🎶", message: "Listen to classic Christmas songs. Jingle Bells, Jingle Bells~" },
    { day: 7, icon: "✉️", message: "Write a card to a friend you haven't seen in a while." },
    { day: 8, icon: "🎄", message: "Time to decorate the tree! Put the brightest star on top." },
    { day: 9, icon: "🦌", message: "Rudolph the red-nosed reindeer is warming up!" },
    { day: 10, icon: "🧣", message: "Wear your warmest scarf and take a walk to feel the festive vibe." },
    { day: 11, icon: "🍬", message: "Eat a candy cane. Sweet treats make everything better." },
    { day: 12, icon: "🔔", message: "Ding Dong! Do you hear the bells ringing in the distance?" },
    { day: 13, icon: "☃️", message: "If it snows, don't forget to build a cute snowman." },
    { day: 14, icon: "🎁", message: "Started wrapping gifts yet? Don't forget the bow!" },
    { day: 15, icon: "🏠", message: "Decorate the house with family. Make every corner cozy." },
    { day: 16, icon: "🍊", message: "Eat an orange for Vitamin C. Stay healthy for Christmas!" },
    { day: 17, icon: "✨", message: "Admire the Christmas lights. The world is sparkling." },
    { day: 18, icon: "📚", message: "Read a Christmas storybook and relive childhood dreams." },
    { day: 19, icon: "🧸", message: "Donate old toys or clothes. Share the love with others." },
    { day: 20, icon: "🍰", message: "Ordered your Christmas cake? Or are you baking one?" },
    { day: 21, icon: "🍷", message: "Make some Mulled Wine to warm yourself up." },
    { day: 22, icon: "🗓️", message: "Christmas is just around the corner. Check your list!" },
    { day: 23, icon: "🛷", message: "Ready for Christmas Eve? The excitement is building!" },
    { day: 24, icon: "🎅", message: "Merry Christmas Eve! Sleep tight, Santa is coming!" }
];

// Initialize: Read opened days from LocalStorage
let openedDays = JSON.parse(localStorage.getItem('adventCalendarState')) || [];

function isDayLocked(day) {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11, Dec is 11
    const currentDay = today.getDate();

    // Logic for testing: If not December, assuming testing mode or handle appropriately.
    // For this demo, let's assume if it's NOT December, we treat it based on "Before" or "After".
    // Before Dec (Jan-Nov of same year): Locked.
    // However, to ensure the user can test this NOW (whatever date it is), 
    // we might want to be lenient if it's not Dec. 
    // BUT, strict requirements say "unable to click for > today".
    
    if (currentMonth < 11) {
       // It's Jan-Nov. Technically too early for Advent Calendar.
       // Let's lock everything. 
       // UNLESS user wants to test? 
       // Let's stick to the prompt's implied date "Dec 9".
       // If the system date is actually Dec 9, this works.
       return true; 
    }
    
    if (currentMonth > 11) return false; // Past December (Next year?) - unlikely with getMonth() unless different year handling.
    
    // In December
    return day > currentDay;
}

function initCalendar() {
    calendarContainer.innerHTML = ''; 

    adventData.forEach(item => {
        const dayBox = document.createElement('div');
        dayBox.classList.add('day-box');
        dayBox.dataset.day = item.day;
        
        const locked = isDayLocked(item.day);

        if (locked) {
            dayBox.classList.add('locked');
            dayBox.innerHTML = `<div class="day-number">${item.day}</div><div class="lock-icon">🔒</div>`;
            dayBox.addEventListener('click', () => {
                // Shake animation
                dayBox.classList.add('shake');
                setTimeout(() => dayBox.classList.remove('shake'), 500);
            });
        } else {
            // Unlocked
             if (openedDays.includes(item.day)) {
                dayBox.classList.add('opened');
                dayBox.innerHTML = `<div class="opened-indicator">${item.icon}</div>`;
            } else {
                dayBox.innerHTML = `<div class="day-number">${item.day}</div>`;
            }
            // Click event for unlocking/viewing
            dayBox.addEventListener('click', () => openDay(item, dayBox));
        }

        calendarContainer.appendChild(dayBox);
    });
}

function openDay(item, element) {
    // Show Modal
    modalDay.textContent = `December ${item.day}`;
    modalImage.textContent = item.icon;
    modalMessage.textContent = item.message;
    modal.classList.add('show');
    modal.classList.remove('hidden');

    // Save state if new
    if (!openedDays.includes(item.day)) {
        openedDays.push(item.day);
        localStorage.setItem('adventCalendarState', JSON.stringify(openedDays));
        
        // Update UI
        element.classList.add('opened');
        
        // Clear content and add icon with animation
        element.innerHTML = '';
        const iconDiv = document.createElement('div');
        iconDiv.classList.add('opened-indicator');
        iconDiv.textContent = item.icon;
        element.appendChild(iconDiv);
    }
}

// Close Modal
closeBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

function closeModal() {
    modal.classList.remove('show');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// Reset
resetBtn.addEventListener('click', () => {
    if(confirm('Are you sure you want to reset the calendar?')) {
        localStorage.removeItem('adventCalendarState');
        openedDays = [];
        initCalendar();
    }
});

// Start
initCalendar();