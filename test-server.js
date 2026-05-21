const express = require('express');
const path = require('path');
const app = express();

app.use((req, res, next) => {
    let cleanUrl = req.url.split('?')[0];
    if (cleanUrl.startsWith('/pages/') && !cleanUrl.endsWith('.html')) {
        req.url = cleanUrl + '.html' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
    }
    next();
});

app.use(express.static(path.join(__dirname)));

const PORT = 8081;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});
