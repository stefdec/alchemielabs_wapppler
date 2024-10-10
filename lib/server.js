require('dotenv').config();


process.on('uncaughtException', (e) => {
    // prevent errors from killing the server and just log them
    console.error(e);
});

const config = require('./setup/config');
const debug = require('debug')('server-connect:server');
const secure = require('./setup/secure');
const routes = require('./setup/routes');
const sockets = require('./setup/sockets');
const upload = require('./setup/upload');
const cron = require('./setup/cron');
const http = require('http');
const express = require('express');
const endmw = require('express-end');
const cookieParser = require('cookie-parser');
const session = require('./setup/session'); //require('express-session')(Object.assign({ secret: config.secret }, config.session));
const cors = require('cors');
const app = express();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const OpenAI = require('openai');
const sharp = require('sharp');

OPENAI_API_KEY = process.env.OPENAI_API_KEY;
WEBSITE_URL = process.env.WEBSITE_URL;
SPREADSHEET_ID = process.env.SPREADSHEET_ID;

console.log(SPREADSHEET_ID);

const googleKeyPath = "alchemielabsphoto.json";
const openai = new OpenAI(OPENAI_API_KEY);

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/'); // Specify the destination directory
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Use the original filename
    }
});

// Initialize multer with the storage configuration
const upld_img = multer({ storage: storage });

app.post('/upload_img', upld_img.single('image'), (req, res) => {
    console.log('File uploaded:', req.file);
    res.status(200).contentType('text/plain').end('File uploaded!');
});

// This is the endpoint to handle the DELETE request
app.delete('/delete-file', (req, res) => {
    // Get the file path from the query parameters
    const filePath = `../public/uploads/${req.query.path}`;
    console.log(filePath);
    // Make sure the path exists and sanitize it to prevent directory traversal attacks
    const absolutePath = path.join(__dirname, filePath);
    console.log('Absolute file path:', absolutePath);

    // Check if the file exists
    fs.stat(absolutePath, (err, stats) => {
        if (err) {
            // If the file doesn't exist, send a 404 response
            return res.status(404).send('File not found');
        }

        // Delete the file
        fs.unlink(absolutePath, (err) => {
            if (err) {
                // If there's an error during file deletion, send a 500 response
                return res.status(500).send('Error deleting file');
            }

            // If file deletion is successful, send a 200 response
            res.status(200).send('File deleted successfully');
        });
    });
});

// Handle image path and data extraction
app.get('/extract_text', async (req, res) => {
    const imgPath = req.query.imgpath;

    // Log the retrieved path
    console.log(`Image Path: ${imgPath}`);

    if (!imgPath) {
        return res.status(400).json({ error: 'Image paths are required' });
    }
    try {
        imageUrl = `${WEBSITE_URL}/uploads/${imgPath}`;
        //imageUrl = `${WEBSITE_URL}/uploads/dl500.jpg`;
        console.log('Extracting text from image:', imageUrl);

        const prompt = `Extract the following information from the provided ID and return ONLY key-value pairs, nothing else, no dash, no special characters. Each pair separated by a comma. If any value is unreadable or missing, use 'nan' instead.:
                    - Type of ID
                    - State
                    - License number
                    - Date of birth
                    - Expiry date
                    - Date issued
                    - First name
                    - Middle initials
                    - Last name
                    - Street address
                    - City
                    - State (from address)
                    - Zip code`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                "url": imageUrl,
                            },
                        },
                    ],
                },
            ],
        });
        console.log(response.choices[0].message.content);

        res.json({ extractedData: response.choices[0].message.content });

    } catch (error) {
        console.error('Error extracting text:', error);
        res.status(500).json({ error: 'Failed to extract text from images' });
    }
});

// Body parser to handle JSON data
app.use(bodyParser.json());

app.set('trust proxy', true);
app.set('view engine', 'ejs');
app.set('view options', { root: 'views', async: true });

app.disable('x-powered-by')

if (config.compression) {
    const compression = require('compression');
    app.use(compression());
}

if (config.abortOnDisconnect) {
    app.use((req, res, next) => {
        req.isDisconnected = false;
        req.on('close', () => {
            req.isDisconnected = true;
        });

        next();
    });
}

app.use(cors(config.cors));
app.use(express.static('public', config.static));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString()
    }
}));
app.use(cookieParser(config.secret));
app.use(session);
app.use(endmw);

upload(app);
secure(app);
routes(app);

const server = http.createServer(app);
const io = sockets(server, session);

// Make sockets global available
global.io = io;


async function combineImagesVertically(imagePath1, imagePath2, outputPath, padding = 20) {
    try {
        // Load both images into Sharp
        const image1 = await sharp(imagePath1).toBuffer();
        const image2 = await sharp(imagePath2).toBuffer();

        // Get metadata of both images to determine their widths and heights
        const [metadata1, metadata2] = await Promise.all([
            sharp(imagePath1).metadata(),
            sharp(imagePath2).metadata(),
        ]);

        // Calculate the new dimensions for the combined image, adding space between the images
        const combinedWidth = Math.max(metadata1.width, metadata2.width);
        const combinedHeight = metadata1.height + metadata2.height + padding;

        // Create a blank canvas with the calculated dimensions
        const combinedImage = sharp({
            create: {
                width: combinedWidth,
                height: combinedHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 }, // White background
            },
        });

        // Composite the two images onto the canvas with padding
        const outputBuffer = await combinedImage
            .composite([
                { input: image1, top: 0, left: 0 }, // Place first image at the top
                { input: image2, top: metadata1.height + padding, left: 0 }, // Place second image below the first one with padding
            ])
            .png()
            .toBuffer();

        // Write the output image to the file system
        fs.writeFileSync(outputPath, outputBuffer);
        console.log('Images combined successfully into:', outputPath);

        // Delete the original files
        fs.unlinkSync(imagePath1);
        fs.unlinkSync(imagePath2);
        console.log('Original image files deleted successfully.');

        return true;
    } catch (error) {
        console.error('Error combining images:', error);
        return false;
    }
}

const fullPath = path.join(__dirname, googleKeyPath);
console.log('Full key file path:', fullPath);

if (!fs.existsSync(fullPath)) {
    console.error('Error: Key file not found at the specified path.');
} else {
    console.log('Key file exists. Proceeding...');
}

// Load your service account key from a file
const auth = new google.auth.GoogleAuth({
    keyFile: fullPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function appendDataToSheet(auth, data) {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = SPREADSHEET_ID

    const request = {
        spreadsheetId: spreadsheetId,
        range: 'A1', // Only specify the sheet name, no specific range
        valueInputOption: 'USER_ENTERED', // Google Sheets will format the values as if entered by the user
        insertDataOption: 'INSERT_ROWS', // Insert new rows at the bottom of the sheet
        resource: {
            values: [data], // Data to insert as a row
        },
    };

    try {
        const response = await sheets.spreadsheets.values.append(request);
        console.log('Data appended successfully:', response.data);
        return true;
    } catch (error) {
        console.error('Error appending data:', error);
        return false;
    }
}

app.post('/save_to_sheet', async (req, res) => {
    try {
        const { photo1, photo2, id_type, state, licence_number, dob, expiry, issuance, first_name, initials, last_name, street, city, state_address, zip_code } = req.body;
        const requiredFields = ['id_type', 'state', 'licence_number', 'dob', 'expiry', 'issuance', 'first_name', 'initials', 'last_name', 'street', 'city', 'state_address', 'zip_code'];
        const missingFields = requiredFields.filter(field => !req.body[field]);

        if (missingFields.length > 0) {
            return res.status(400).send(`Missing required fields: ${missingFields.join(', ')}`);
        }


        // Append data to Google Sheets
        let saveMessage = '';
        const isSaved = await appendDataToSheet(auth, [id_type, state, licence_number, dob, expiry, issuance, first_name, initials, last_name, street, city, state_address, zip_code]);
        isSaved ? saveMessage = 'Data saved to google sheet' : saveMessage = 'Data NOT saved to google sheet'

        console.log(saveMessage);

        const photo1_path = path.join(__dirname, `../public/uploads/${photo1}`);
        const photo2_path = path.join(__dirname, `../public/uploads/${photo2}`);
        const new_image_name = `${last_name}_${first_name}_${licence_number}.png`
        const new_image_path = path.join(__dirname, `../public/uploads/${new_image_name}`);

        if (!combineImagesVertically(photo1_path, photo2_path, new_image_path, 20)) {
            res.status(500).send('Error saving data');
        }

        res.json({ success: true, imageFile: new_image_name });
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).send('Error saving data');
    }
});



module.exports = {
    server, app, io,
    start: function (port) {
        // We add the 404 and 500 routes as last
        app.use((req, res) => {
            // if user has a custom 404 page, redirect to it
            if (req.accepts('html') && req.url != '/404' && app.get('has404')) {
                //res.redirect(303, '/404');
                req.url = '/404';
                app.handle(req, res);
            } else {
                res.status(404).json({
                    status: '404',
                    message: `${req.url} not found.`
                });
            }
        });

        app.use((err, req, res, next) => {
            debug(`Got error? %O`, err);
            // if user has a custom 500 page, redirect to it
            if (req.accepts('html') && req.url != '/500' && app.get('has500')) {
                //res.redirect(303, '/500');
                req.url = '/500';
                app.handle(req, res);
            } else {
                res.status(500).json({
                    status: '500',
                    code: config.debug ? err.code : undefined,
                    message: config.debug ? err.message || err : 'A server error occured, to see the error enable the DEBUG flag.',
                    stack: config.debug ? err.stack : undefined,
                });
            }
        });

        cron.start();

        server.listen(port || config.port, () => {
            console.log(`App listening at http://localhost:${config.port}`);
        });
    }
};
