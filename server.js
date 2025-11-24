const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Mock Database (In-memory)
let documents = [
    { id: 1, name: 'Project_Alpha_Specs.docx', status: 'Draft', author: 'Alice', date: '2023-10-25' },
    { id: 2, name: 'Q3_Financial_Report.docx', status: 'Review', author: 'Bob', date: '2023-10-26' },
    { id: 3, name: 'Vendor_Contract_v2.docx', status: 'Approved', author: 'Charlie', date: '2023-10-24' }
];

// --- Routes ---

// Dashboard
app.get('/', (req, res) => {
    res.render('index', { documents: documents });
});

// Upload Handler
app.post('/upload', upload.single('document'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;

    // In a real app, we might just store the file and wait for the user to open it.
    // Here, we redirect to the editor immediately or add it to the list.
    // Let's add it to the list and then redirect to edit it.

    const newDoc = {
        id: documents.length + 1,
        name: req.file.originalname,
        status: 'Draft',
        author: 'Current User',
        date: new Date().toISOString().split('T')[0],
        filePath: filePath // Store path to load later
    };
    documents.push(newDoc);

    res.redirect(`/edit/${newDoc.id}`);
});

// Editor View
app.get('/edit/:id', (req, res) => {
    const docId = parseInt(req.params.id);
    const doc = documents.find(d => d.id === docId);

    if (!doc) {
        return res.status(404).send('Document not found');
    }

    if (doc.filePath) {
        // Convert DOCX to HTML for the editor
        mammoth.convertToHtml({ path: doc.filePath })
            .then(function(result){
                const html = result.value; // The generated HTML
                const messages = result.messages; // Any messages, such as warnings during conversion
                res.render('editor', { doc: doc, content: html, messages: messages });
            })
            .catch(function(err){
                console.error(err);
                res.status(500).send("Error converting document.");
            });
    } else {
        // Mock content if no file path (for pre-seeded mock data)
        res.render('editor', { doc: doc, content: "<h1>Mock Content</h1><p>This is a placeholder for a file that doesn't exist on disk in this stateless MVP.</p>", messages: [] });
    }
});

// Save Handler (Mock)
app.post('/save/:id', (req, res) => {
    const docId = parseInt(req.params.id);
    const doc = documents.find(d => d.id === docId);

    if (doc) {
        // Here we would convert HTML back to DOCX or update the status
        // For MVP, we just update status to "Review"
        doc.status = 'Review';
        // Logic to save the 'content' from the body to a file would go here
        console.log(`Document ${docId} content updated.`);
    }

    res.redirect('/');
});

// Admin/Status Update (Mock)
app.post('/approve/:id', (req, res) => {
    const docId = parseInt(req.params.id);
    const doc = documents.find(d => d.id === docId);
    if(doc) doc.status = 'Approved';
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
