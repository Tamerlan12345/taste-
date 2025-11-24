const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // For downloading file from ONLYOFFICE

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('Created uploads directory');
}

// Если задана переменная PUBLIC_URL (на Railway), используем её.
// Иначе — работаем по старому сценарию для локальной разработки.
const BASE_URL = process.env.PUBLIC_URL || `http://${process.env.MY_IP || 'localhost'}:${PORT}`;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads')); // Open access to uploads folder
app.set('view engine', 'ejs');

// Helper to fix filename encoding (latin1 to utf8)
const fixEncoding = (str) => {
    try {
        return Buffer.from(str, 'latin1').toString('utf8');
    } catch (e) {
        return str;
    }
};

// Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, fixEncoding(file.originalname))
});
const upload = multer({ storage: storage });

let documents = [
    // Example document
    // {
    //     id: 1,
    //     name: 'contract.docx',
    //     url: `${BASE_URL}/uploads/contract.docx`,
    //     key: 'key1' + Date.now(),
    //     status: 'Draft'
    // }
];

// --- Routes ---

app.get('/', (req, res) => {
    res.render('index', { documents: documents });
});

app.post('/upload', upload.single('document'), (req, res) => {
    if (!req.file) return res.status(400).send('No file.');

    const newDoc = {
        id: documents.length + 1,
        name: req.file.filename, // Use the fixed filename from storage
        url: `${BASE_URL}/uploads/${req.file.filename}`,
        key: Date.now().toString(), // Generate new key for editing session
        status: 'Draft'
    };
    documents.push(newDoc);
    res.redirect(`/edit/${newDoc.id}`);
});

// Editor Page
app.get('/edit/:id', (req, res) => {
    const doc = documents.find(d => d.id == req.params.id);
    if (!doc) return res.status(404).send('Not found');

    // Pass settings for ONLYOFFICE
    res.render('editor_onlyoffice', {
        doc: doc,
        documentServerUrl: process.env.DOCUMENT_SERVER_URL || 'http://localhost:8080', // Address of ONLYOFFICE Docker container
        callbackUrl: `${BASE_URL}/track`
    });
});

// === MOST IMPORTANT: Callback for saving ===
// ONLYOFFICE will hit this when editing is finished
app.post('/track', async (req, res) => {
    const { status, url, key } = req.body;

    // Status 2 or 6 means the document is ready for saving
    if (status === 2 || status === 6) {
        console.log(`Document changed. Downloading from: ${url}`);

        try {
            // Download the updated file from ONLYOFFICE server
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream'
            });

            // Find file name by key (in real DB search by ID)
            const doc = documents.find(d => d.key === key) || documents[documents.length-1];

            // Determine file path
            // Note: In a real app we would want to ensure we don't overwrite if names clash,
            // but here we follow the simplified logic.
            const filePath = path.join(__dirname, 'uploads', doc.name);

            // Overwrite file on disk
            const writer = fs.createWriteStream(filePath);
            writer.on('error', (err) => {
                console.error('Error writing file:', err);
            });
            response.data.pipe(writer);

            writer.on('finish', () => {
                console.log('File updated successfully on disk!');
                // Update key so server knows version is new next time it opens
                doc.key = Date.now().toString();
            });

        } catch (error) {
            console.error('Error saving file:', error);
        }
    }

    // Must respond to server that everything is OK
    res.json({ error: 0 });
});

app.listen(PORT, () => {
    console.log(`Server running at ${BASE_URL}`);
});
