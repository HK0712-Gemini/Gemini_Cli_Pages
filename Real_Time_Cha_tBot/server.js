const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3000;
const MODEL = 'models/gemini-live-2.5-flash-preview';

const server = http.createServer((req, res) => {
    // CORS settings
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // No need for X-API-Key in header now

    if (req.method === 'OPTIONS') {
        res.writeHead(204); res.end(); return;
    }

    // Handle chat requests
    if (req.method === 'POST' && req.url === '/chat') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                // MODIFICATION: Expect 'history' array instead of 'message'
                const { history, apiKey } = JSON.parse(body);
                if (!history || !apiKey) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: "History and API key are required." }));
                }

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                });

                // --- WebSocket Connection ---
                const host = 'generativelanguage.googleapis.com';
                const url = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
                
                const ws = new WebSocket(url);
                
                ws.on('open', function open() {
                    // (A) Send setup
                    ws.send(JSON.stringify({
                        setup: {
                            model: MODEL,
                            generation_config: { response_modalities: ["TEXT"] }
                        }
                    }));

                    // (B) Send the full chat history from the client
                    ws.send(JSON.stringify({
                        client_content: {
                            turns: history, // MODIFICATION: Use the history from the request
                            turn_complete: true
                        }
                    }));
                });

                ws.on('message', function incoming(data) {
                    try {
                        const response = JSON.parse(data.toString());
                        if (response.serverContent?.modelTurn?.parts) {
                            for (const part of response.serverContent.modelTurn.parts) {
                                if (part.text) {
                                    // Stream data back to the frontend in the expected format
                                    const sseData = {
                                        candidates: [{ content: { parts: [{ text: part.text }] } }]
                                    };
                                    res.write(`data: ${JSON.stringify(sseData)}

`);
                                }
                            }
                        }
                        if (response.serverContent?.turnComplete) {
                            ws.close();
                        }
                    } catch (e) { console.error("Parsing error:", e); }
                });

                ws.on('close', () => {
                    res.end(); // Simply end the response when the WebSocket closes
                });

                ws.on('error', (err) => {
                    console.error('WebSocket Error:', err);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                    }
                    res.end(JSON.stringify({ error: `WebSocket error: ${err.message}` }));
                });

            } catch (error) {
                console.error('Server Error:', error);
                if (!res.headersSent) res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }
    
    // Serve static files (HTML, CSS, JS)
    if (req.method === 'GET') {
        let filePath = req.url === '/' ? 'index.html' : req.url;
        const fullPath = path.join(__dirname, filePath);
        const ext = path.extname(fullPath);

        let contentType = 'text/html';
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.js') contentType = 'application/javascript';

        fs.readFile(fullPath, (err, content) => { 
            if (err) { res.writeHead(404); res.end('Not Found'); } 
            else { res.writeHead(200, { 'Content-Type': contentType }); res.end(content); }
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
