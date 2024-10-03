const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const sql = require("mssql");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const multer = require('multer');
const path = require('path'); 
const http = require("http"); // Add this line to import the 'http' module
const cors = require("cors");
const fs = require('fs');
const Server = require('socket.io').Server;
const CryptoJS = require('crypto-js');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');

const https = require('https');

// const options = {
//     key: fs.readFileSync('privatekey.pem'),
//     cert: fs.readFileSync('certificate.pem')
// };

// const server = https.createServer(options, app);

// const server = http.createServer(app);


var conStr = require('./data/config');
const { log } = require("console");

const pool = new sql.ConnectionPool({
    ...conStr,
    pool: {
        max: 5000, // Increase as needed based on server load
        min: 0,
        idleTimeoutMillis: 30000,
    },
});

pool.on("error", (err) => {
    console.error("Pool error:", err);
});
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    // Handle the error, log it, or exit the process
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

// app.use(cors({
//     origin: 'http://localhost:3000',
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
// }));

// Set headers to allow CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

// app.use((req, res, next) => {
//     res.header("Access-Control-Allow-Origin", "*"); // Allows all origins (for testing purposes)
//     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//     res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
//     next();
// });


// ..............................................socket connection......................................

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

io.on('connection', (socket) => {
    // //('connected');
    socket.on("chat", chat => {
    io.emit("chat", chat)
})
    // Optionally, you can listen for a specific event from the client
    socket.on('disconnect', () => {
    //('Client disconnected');
    });
});

// ..............................................socket connection......................................

const storage = multer.memoryStorage(); // Store the file in memory first

const upload = multer({ storage });

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.post('/upload/:formattedDate/:formattedTime/:user_id/:user', upload.single('file'), async (req, res) => {
    const itemDetails = JSON.parse(req.body.itemDetails);
    //(itemDetails);
    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime
    const user_id = req.params.user_id
    const user = req.params.user
    //(user_id);
    // const Database = JSON.parse(req.body.Company);
    // const Company = JSON.parse(req.body.Company);
    //(itemDetails);
    const Id = req.body.id || ''
    // const Img = req.body.img || ''
    
    // //(Id,Img);

    const customName = req.body.customName;
    const fileExt = path.extname(req.file && req.file.originalname);  // Get the original file extension
    const fileName = customName + fileExt; // Create the custom filename
    // const connectionConfig = { ...defaultConfig, database: Database};

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        // //("adding 1");
        if (Id) {
            // //(Id);
        } else {
            request.input('statementType', sql.NVarChar(255), 'ItemReg');
            request.input('itemName', sql.NVarChar(255), itemDetails.itemName);
            request.input('category', sql.NVarChar(255), itemDetails.category);
            request.input('rate', sql.Money, itemDetails.rate);
            request.input('img', sql.NVarChar(255), fileName);
            request.input('cost', sql.Money, itemDetails.cost);
            request.input('itemCode', sql.NVarChar(255), itemDetails.itemCode);
            request.input('ddate', sql.Date, formattedDate);
            request.input('ttime', sql.NVarChar(255), formattedTime);
            request.input('user_id', sql.Int, user_id);
            request.input('username', sql.NVarChar(255), user);
            request.input('des', sql.NVarChar(250), 'Item Registered');

            const result = await request.execute('Sp_Item');

            // if (!req.file || !Img) {
            //     return res.status(400).json({ success: false, message: 'No file uploaded' });
            // }

            // const customName = req.body.customName;
            // const fileExt = path.extname(req.file.originalname);  // Get the original file extension
            // const fileName = customName + fileExt; // Create the custom filename
            const uploadDir = path.join(__dirname, 'public/uploads');

            // Check if 'Database' folder exists, create it if notsss
            fs.access(uploadDir, fs.constants.F_OK, (err) => {
                if (err) {
                    // 'Database' folder does not exist, create it
                    fs.mkdir(uploadDir, { recursive: true }, (err) => {
                        if (err) {
                            return res.status(500).json({ success: false, message: 'Failed to create Database folder' });
                        }
                        saveFile();
                    });
                } else {
                    // 'Database' folder already exists
                    saveFile();
                }
            });

            // Function to save the file to the disk
            function saveFile() {
                const filePath = path.join(uploadDir, fileName); 

                // Save the file to the disk
                fs.writeFile(filePath, req.file.buffer, (err) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Error saving the file' });
                    }

                    res.json({
                        success: true,
                        filePath: `/uploads/${fileName}`, // Send the relative path to the uploaded file in 'Database' folder
                    });
                });
            }
        }

    } catch (error) {
        console.error('Error inserting data:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/modifyItem/:formattedDate/:formattedTime/:user_id/:user', upload.single('file'), async (req, res) => {
    const itemDetails = JSON.parse(req.body.itemDetails);
    const image = itemDetails.img;
    const id = itemDetails.id;
    const file = req.file;

    const customName = req.body.customName;
    const fileExt = path.extname(file ? file.originalname : image); // Get the original file extension
    const fileName = customName + fileExt;

    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime
    const user_id = req.params.user_id
    const user = req.params.user

    //(user);
    // const now = new Date();
    // const formattedDate = now.toISOString().split('T')[0]; // yyyy-mm-dd
    // const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    // const formattedTime = now.toLocaleTimeString([], options);

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('statementType', sql.NVarChar(255), 'ItemModify');
        request.input('itemName', sql.NVarChar(255), itemDetails.itemName);
        request.input('category', sql.NVarChar(255), itemDetails.category);
        request.input('rate', sql.Money, itemDetails.rate);
        request.input('img', sql.NVarChar(255), fileName);
        request.input('cost', sql.Money, itemDetails.cost);
        request.input('id', sql.Int, id);
        request.input('ddate', sql.Date, formattedDate);
        request.input('ttime', sql.NVarChar(255), formattedTime);
        request.input('user_id', sql.NVarChar(255), user_id);
        request.input('itemCode', sql.NVarChar(255), itemDetails.itemCode);
        request.input('username', sql.NVarChar(255), user);
        request.input('des', sql.VarChar(250), 'Item Modified');

        const result = await request.execute('Sp_Item');
        // const result = await request.query(`
        //     UPDATE ItemReg
        //     SET itemName = @itemName, category = @category, rate = @rate, img = @img, cost = @cost, itemCode = @itemCode
        //     WHERE id = ${id};
        // `);
        // request.input('name', sql.NVarChar(255), itemDetails.itemName);
        // request.input('statementType', sql.NVarChar(255), 'ItemModify');
        // request.input('id', sql.Int, id);
        // await request.execute('Sp_Ev_Operations')
        const uploadDir = path.join(__dirname, 'public/uploads');

        // Check if 'uploads' folder exists, create it if not
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const existingImagePath = path.join(uploadDir, image);
        const newImagePath = path.join(uploadDir, fileName);

        // Function to save the file to the disk
        const saveFile = () => {
            if (file) {
                fs.writeFile(newImagePath, file.buffer, (err) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Error saving the file' });
                    }
                    res.json({
                        success: true,
                        filePath: `/uploads/${fileName}`, // Send the relative path to the uploaded file
                    });
                });
            } else {
                res.json({
                    success: true,
                    message: 'Item updated successfully',
                });
            }
        };

        // Check if the image with the current name exists
        if (fs.existsSync(existingImagePath)) {
            // Rename the existing image to the new file name
            fs.rename(existingImagePath, newImagePath, (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error renaming the existing file' });
                }
                saveFile();
            });
        } else {
            // Save the new file directly if the image does not exist
            saveFile();
        }

        poolConnect.release(); // Release the pool connection
    } catch (error) {
        console.error('Error processing request:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getItems', async (req, res) => {
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        const result = await request.query(`
            SELECT * 
            FROM ItemReg
        `);
        const data = result.recordset
        // //(result.recordset);
        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// get

app.get('/deleteItem/:formattedDate/:formattedTime/:Data/:user_id/:user', async (req, res) => {
    const Data = JSON.parse(req.params.Data);
    const user_id = req.params.user_id
    const user = req.params.user
    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime

    const id = Data.id;
    const img = Data.img;

    // const now = new Date();
    // const formattedDate = now.toISOString().split('T')[0]; // yyyy-mm-dd
    // const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    // const formattedTime = now.toLocaleTimeString([], options);

    try {
        // Connect to the database
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        // Delete the item from the database
        // request.input('id', sql.Int, id);
        // await request.query(`
        //     DELETE FROM ItemReg
        //     WHERE id = @id
        // `);
        request.input('img', sql.VarChar(250),'');
        request.input('itemName', sql.NVarChar(255), Data.itemName);
        request.input('category', sql.NVarChar(255), Data.category);
        request.input('rate', sql.Money, Data.rate);
        request.input('cost', sql.Money, Data.cost);
        request.input('itemCode', sql.NVarChar(255), Data.itemCode);
        request.input('id', sql.Int, id);
        request.input('des', sql.VarChar(250), 'Item Deleted');
        request.input('ddate', sql.Date, formattedDate);
        request.input('ttime', sql.NVarChar(255), formattedTime);
        request.input('user_id', sql.NVarChar(255), user_id);
        request.input('username', sql.NVarChar(255), user);
        request.input('statementType', sql.NVarChar(255), 'ItemDelete');
        await request.execute('Sp_Item')
        // Construct the path to the image file
        const uploadDir = path.join(__dirname, 'public/uploads');
        const imagePath = path.join(uploadDir, img);

        // Delete the image file from the server
        if (fs.existsSync(imagePath)) {
            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.error('Error deleting image file:', err.message);
                    return res.status(500).json({ success: false, message: 'Error deleting image file' });
                }
                // Send success response after file is deleted
                res.status(200).json({ success: true, message: 'Item and image deleted successfully' });
            });
        } else {
            // If the file does not exist, just send a success response
            res.status(200).json({ success: true, message: 'Item deleted successfully, but image file not found' });
        }

        // Release the database connection
        poolConnect.release();
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// const httpsAgent = new https.Agent({  
//     rejectUnauthorized: false
//   });

app.get('/userLogin/:formattedDate/:formattedTime/:userInfo', async (req, res) => {
    const userInfo = JSON.parse(req.params.userInfo);

    // const now = new Date();
    // const formattedDate = now.toISOString().split('T')[0]; // yyyy-mm-dd
    // const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    // const formattedTime = now.toLocaleTimeString([], options);

    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('statementType', sql.NVarChar(255), 'UserLogin');
        request.input('username', sql.NVarChar(255), userInfo.username);
        request.input('password', sql.NVarChar(255), userInfo.password);
        request.input('ddate', sql.Date, formattedDate);
        request.input('ttime', sql.NVarChar(255), formattedTime);
        const result = await request.execute('Sp_UserManage');
        // //(result);
        //("asd",result.recordset[0]);
        if (result.recordset[0].Message == 1) {
            const user = result.recordset[0];
            //(user);
            res.status(200).json({ data :user });
        } else {
            // User not found
            res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

const secretKey = 'Shersoft-software-company';

app.get('/getUserRights/:user_id', async (req, res) => {
    const user_id = req.params.user_id
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('user_id', sql.Int, user_id);
        const result = await request.query(`
            SELECT * 
            FROM UserRights
            WHERE user_id = @user_id
        `);
        // //(result);
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            // Encrypt the user object using AES encryption
            const userString = JSON.stringify({ userRights: user });
            const encryptedUser = CryptoJS.AES.encrypt(userString, secretKey).toString();

            res.status(200).json(encryptedUser);
            // res.status(200).json({ userRights :user });
        } else {
            // User not found
            res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ProfileImage upload endpoint
app.post('/profileImg/:name', upload.single('image'), async (req, res) => {
    // const id = req.params.id;              // ID of the user
    const imageName = req.params.name;     // Image name from the route parameters
    const imageBuffer = req.file.buffer;   // Binary data of the uploaded image

    try {
        const poolConnect = await pool.connect(); // Connect to the MSSQL pool
        const request = poolConnect.request();

        // Set the input parameters for the query
        // request.input('id', sql.Int, id);
        request.input('imageName', sql.NVarChar, imageName);
        request.input('imageData', sql.VarBinary, imageBuffer);

        // SQL UPDATE statement (not INSERT) to update the user's image in the database
        await request.query(
            'UPDATE Users SET imgName = @imageName, imgData = @imageData WHERE username = @imageName'
        );

        // Send a success response
        res.status(200).json({ message: 'Image uploaded successfully!' });
    } catch (err) {
        // Catch and handle any errors
        console.error(err.message);  // Log the error for debugging
        res.status(500).send({ message: 'Error uploading image', error: err.message });
    }
});

// Endpoint to retrieve ProfileImage from the database
app.get('/getProfileImg/:name', async (req, res) => {
    const name = req.params.name;

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('name', sql.NVarChar, name);

        const result = await request.query('SELECT imgName, imgData FROM Users WHERE username = @name');

        if (result.recordset.length > 0) {
            const imgData = result.recordset[0].imgData;
            const mimeType = 'image/webp'; // Set the correct MIME type based on your image

            // Convert binary data to Base64 string
            const base64Image = Buffer.from(imgData).toString('base64');
            
            // Send Base64 image and MIME type to the frontend
            res.json({ base64Image, mimeType });
        } else {
            res.status(404).json({ message: 'Image not found' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send({ message: 'Error retrieving image', error: err.message });
    }
});



app.post('/userRightsNew/:formattedDate/:formattedTime/:user_id/:user', async (req, res) => {
    const userRights = req.body;

    const user_id = req.params.user_id;
    //(user_id);
    const user = req.params.user;
    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime
    //(userRights);
    // Get current date and time
    // const now = new Date();
    // const formattedDate = now.toISOString().split('T')[0]; // yyyy-mm-dd
    // const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    // const formattedTime = now.toLocaleTimeString([], options);
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('statementType', sql.NVarChar(255), 'userRightsNew');
        request.input('type', sql.NVarChar(255), userRights.type);
        request.input('save', sql.Int, userRights.ssave);
        request.input('item_registration', sql.Int, userRights.item_registration);
        request.input('menu', sql.Int, userRights.menu);
        request.input('find', sql.Int, userRights.find);
        request.input('edit', sql.Int, userRights.edit);
        request.input('delete', sql.Int, userRights.ddelete);
        request.input('orders', sql.Int, userRights.orders);
        request.input('event_details', sql.Int, userRights.event_details);
        request.input('category_reorder', sql.Int, userRights.category_reorder);
        request.input('cost_calculation', sql.Int, userRights.cost_calculation);
        request.input('create_user', sql.Int, userRights.create_user);
        request.input('ddate', sql.Date, formattedDate);
        request.input('ttime', sql.NVarChar(255), formattedTime);
        request.input('U_name', sql.NVarChar(255), user);
        request.input('user_id', sql.Int, user_id);
        const result = await request.execute('Sp_UserManage');
        //(result);
        if (result.returnValue == 1) {
            io.emit('NewUserTypeAdded', { success: true });
            res.status(200).json({ success: true, message: 'success' });
        } else if (result.returnValue == 0) {
            res.status(201).json({ success: false, message: 'Usertype exists!' });
        }
        
    } catch (error) {
        // console.error('Error:');
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/userRightsUpdate/:formattedDate/:formattedTime/:user_id/:user', async (req, res) => {
    const userRights = req.body;

    const user_id = req.params.user_id;
    const user = req.params.user;

    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime

    // const now = new Date();
    // const formattedDate = now.toISOString().split('T')[0]; // yyyy-mm-dd
    // const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    // const formattedTime = now.toLocaleTimeString([], options);
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('statementType', sql.NVarChar(255), 'userRightsUpdate');
        request.input('id', sql.Int, userRights.user_id);
        request.input('type', sql.NVarChar(255), userRights.under);
        request.input('save', sql.Int, userRights.ssave);
        request.input('item_registration', sql.Int, userRights.item_registration);
        request.input('menu', sql.Int, userRights.menu);
        request.input('find', sql.Int, userRights.find);
        request.input('edit', sql.Int, userRights.edit);
        request.input('delete', sql.Int, userRights.ddelete);
        request.input('orders', sql.Int, userRights.orders);
        request.input('event_details', sql.Int, userRights.event_details);
        request.input('category_reorder', sql.Int, userRights.category_reorder);
        request.input('cost_calculation', sql.Int, userRights.cost_calculation);
        request.input('create_user', sql.Int, userRights.create_user);
        request.input('ddate', sql.Date, formattedDate);
        request.input('ttime', sql.NVarChar(255), formattedTime);
        request.input('U_name', sql.NVarChar(255), user);
        request.input('user_id', sql.Int, user_id);
        const result = await request.execute('Sp_UserManage');

        io.emit('UserRightsUpdated', { success: true });
        res.status(200).json({ success: true, message: 'success' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/userInfo/:formattedDate/:formattedTime/:user_id/:user', async (req, res) => {
    const userInfo = req.body;

    const user_id = req.params.user_id;
    const user = req.params.user;

    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime

    // const now = new Date();
    // const formattedDate = now.toISOString().split('T')[0]; // yyyy-mm-dd
    // const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    // const formattedTime = now.toLocaleTimeString([], options);
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('statementType', sql.NVarChar(255), 'userCreate');
        request.input('id', sql.Int, userInfo.under);
        request.input('username', sql.NVarChar(255), userInfo.username);
        request.input('password', sql.NVarChar(255), userInfo.password);
        request.input('email', sql.NVarChar(255), userInfo.email);
        request.input('ddate', sql.Date, formattedDate);
        request.input('ttime', sql.NVarChar(255), formattedTime);
        request.input('user_id', sql.Int, user_id);
        request.input('U_name', sql.NVarChar(255), user);
        const result = await request.execute('Sp_UserManage');

        res.status(200).json({ success: true, message: 'success' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

const convertDateFormat = (dateStr) => {
    // Assuming the input format is 'DD-MM-YYYY'
    const [day, month, year] = dateStr.split('-');

    // Create a new date string in 'YYYY-MM-DD' format
    const formattedDate = `${year}-${month}-${day}`;
    
    return formattedDate;
}
app.post('/statusChanges/:formattedDate/:formattedTime/:id/:status/:input/:user_id/:user', async (req, res) => {

    // const deliveryDate = convertDateFormat(req.params.deliveryDate);
    // const customer_id = req.params.customer_id;
    const id = req.params.id;
    const status = req.params.status;
    const reason = req.params.input;

    // console.log(status);

    const user_id = req.params.user_id;
    const user = req.params.user;
    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime
    // //(reason);

    let description;
    if (status == 0) {
        description = `Orders pending!`
    } else if (status == 2) {
        description = `Orders confirmed!`
    } else if (status == 3) {
        description = `Orders cancelled! : ${reason}`
    }

    // const now = new Date();
    // const formattedDate = now.toISOString().split('T')[0]; // yyyy-mm-dd
    // const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    // const formattedTime = now.toLocaleTimeString([], options);
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('statementType', sql.NVarChar(255), 'CustomerStatus');
        // request.input('deliveryDate', sql.Date, deliveryDate);
        request.input('id', sql.Int, id);
        // request.input('customer_id', sql.Int, customer_id);
        request.input('status', sql.Int, status);
        request.input('description', sql.NVarChar(255), description);
        request.input('DDate', sql.Date, formattedDate);
        request.input('TTime', sql.NVarChar(255), formattedTime);
        request.input('username', sql.NVarChar(255), user);
        request.input('user_id', sql.Int, user_id);
        const result = await request.execute('Sp_CustomerOrders');

        res.status(200).json({ success: true, message: 'success' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getCustomerOrderStatus', async (req, res) => {

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        // request.input('deliveryDate', sql.Date, deliveryDate);
        const result = await request.query(`
            SELECT id,status
            FROM CustomerOrders
        `);
        const data = result.recordset
        //("status",data);
        res.status(200).json({ data :data });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getUserType', async (req, res) => {

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        // request.input('deliveryDate', sql.Date, deliveryDate);
        const result = await request.query(`
            SELECT user_id,under
            FROM UserRights
        `);
        const data = result.recordset
        //("status",data);
        res.status(200).json({ data :data });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getUsers/:user_id', async (req, res) => {

    const id = req.params.user_id

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('id', sql.Int, id);
        const result = await request.query(`
            SELECT id, username
            FROM Users
            WHERE user_id = @id
        `);
        const data = result.recordset
        //("status",data);
        res.status(200).json({ data :data });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getTotalOrders/:id', async (req, res) => {

    const id = req.params.id

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('id', sql.Int, id);
        const result = await request.query(`
            SELECT order_id, orderDate, orderTime, paid_unpaid
            FROM CustomerOrders
            WHERE employee_id = @id
        `);
        const data = result.recordset
        //("status",data);
        res.status(200).json({ data :data });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getYears', async (req, res) => {
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        const result = await request.query(`
            SELECT DISTINCT YEAR(orderDate) AS year
            FROM CustomerOrders
        `);

        const data = result.recordset;
        res.status(200).json({ data: data });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.get('/getFullEventDetails', async (req, res) => {
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        const result = await request.query(`
            SELECT 
                ed.*, 
                u.under 
            FROM 
                EventDetails ed
            LEFT JOIN 
                UserRights u 
            ON 
                ed.UserID = u.user_id
        `);

        const data = result.recordset;
        res.status(200).json({ data: data });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getFullEventDetailsInChange', async (req, res) => {
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        const result = await request.query(`
            SELECT 
                ed.*, 
                u.under 
            FROM 
                EventDetails ed
            LEFT JOIN 
                UserRights u 
            ON 
                ed.UserID = u.user_id
            ORDER BY 
                ed.Auto DESC  -- Ordering by 'Auto' in descending order
        `);

        const data = result.recordset;
        res.status(200).json({ data: data });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.get('/getUser_EventDetails', async (req, res) => {

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        const User_result = await request.query(`
            SELECT user_id,under
		    FROM UserRights
        `);

        const FormName_result = await request.query(`
            SELECT DISTINCT FormName
            FROM EventDetails
            WHERE FormName IS NOT NULL AND FormName <> ''
        `);

        const User_result_data = User_result.recordset
        const User_FormName_result = FormName_result.recordset

        res.status(200).json({ users :User_result_data,form :User_FormName_result   });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getUnderFromUserID', async (req, res) => {

    const id = req.params.id

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('id', sql.Int, id);
        const result = await request.query(`
            SELECT user_id,under
            FROM UserRights
        `);

        const data = result.recordset.map(item => ({
            UserID: item.user_id,
            under: item.under
        }));

        //(data);

        res.status(200).json({ data :data });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/fetchFilteredEventDetails/:details', async (req, res) => {
    const { from, to, user, form, delete: ddelete, edit, login, logout, save } = req.params.details ? JSON.parse(req.params.details) : null;
    //(user);
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        let query = 'SELECT * FROM EventDetails WHERE 1=1'; // Start with a base query

        // Event type filtering (use IN clause for multiple event types)
        const eventTypes = [];
        if (ddelete) eventTypes.push('Delete');
        if (edit) eventTypes.push('Edit');
        if (login) eventTypes.push('Login');
        if (logout) eventTypes.push('Logout');
        if (save) eventTypes.push('Save');

        if (eventTypes.length) {
            query += ` AND EventType IN (${eventTypes.map((type, index) => `@eventType${index}`).join(', ')})`;
            eventTypes.forEach((type, index) => request.input(`eventType${index}`, sql.NVarChar(255), type));
        }

        // Case 1: All four parameters are present
        if (from && to && user && form) {
            request.input('from', sql.Date, from);
            request.input('to', sql.Date, to);
            request.input('user', sql.Int, user);
            request.input('form', sql.NVarChar, form);
            query += ' AND DDate BETWEEN @from AND @to AND UserID = @user AND FormName = @form';
        }
        // Case 2: Only from, to, and user are present
        else if (from && to && user && !form) {
            request.input('from', sql.Date, from);
            request.input('to', sql.Date, to);
            request.input('user', sql.Int, user);
            query += ' AND DDate BETWEEN @from AND @to AND UserID = @user';
        } 
        // Case 3: Only from, to, and form are present
        else if (from && to && !user && form) {
            request.input('from', sql.Date, from);
            request.input('to', sql.Date, to);
            request.input('form', sql.NVarChar, form);
            query += ' AND DDate BETWEEN @from AND @to AND FormName = @form';
        } 
        // Case 4: Only from and to are present
        else if (from && to && !user && !form) {
            request.input('from', sql.Date, from);
            request.input('to', sql.Date, to);
            query += ' AND DDate BETWEEN @from AND @to';
        } 
        // Case 5: Only from, user, and form are present
        else if (from && !to && user && form) {
            request.input('from', sql.Date, from);
            request.input('user', sql.Int, user);
            request.input('form', sql.NVarChar, form);
            query += ' AND DDate >= @from AND UserID = @user AND FormName = @form';
        } 
        // Case 6: Only from and user are present
        else if (from && !to && user && !form) {
            request.input('from', sql.Date, from);
            request.input('user', sql.Int, user);
            query += ' AND DDate >= @from AND UserID = @user';
        } 
        // Case 7: Only from and form are present
        else if (from && !to && !user && form) {
            request.input('from', sql.Date, from);
            request.input('form', sql.NVarChar, form);
            query += ' AND DDate >= @from AND FormName = @form';
        } 
        // Case 8: Only from is present
        else if (from && !to && !user && !form) {
            request.input('from', sql.Date, from);
            query += ' AND DDate >= @from';
        } 
        // Case 9: Only to, user, and form are present
        else if (!from && to && user && form) {
            request.input('to', sql.Date, to);
            request.input('user', sql.Int, user);
            request.input('form', sql.NVarChar, form);
            query += ' AND DDate <= @to AND UserID = @user AND FormName = @form';
        } 
        // Case 10: Only to and user are present
        else if (!from && to && user && !form) {
            request.input('to', sql.Date, to);
            request.input('user', sql.Int, user);
            query += ' AND DDate <= @to AND UserID = @user';
        } 
        // Case 11: Only to and form are present
        else if (!from && to && !user && form) {
            request.input('to', sql.Date, to);
            request.input('form', sql.NVarChar, form);
            query += ' AND DDate <= @to AND FormName = @form';
        } 
        // Case 12: Only to is present
        else if (!from && to && !user && !form) {
            request.input('to', sql.Date, to);
            query += ' AND DDate <= @to';
        } 
        // Case 13: Only user and form are present
        else if (!from && !to && user && form) {
            request.input('user', sql.Int, user);
            request.input('form', sql.NVarChar, form);
            query += ' AND UserID = @user AND FormName = @form';
        } 
        // Case 14: Only user is present
        else if (!from && !to && user && !form) {
            request.input('user', sql.Int, user);
            query += ' AND UserID = @user';
        } 
        // Case 15: Only form is present
        else if (!from && !to && !user && form) {
            request.input('form', sql.NVarChar, form);
            query += ' AND FormName = @form';
        }

        const result = await request.query(query);

        res.status(200).json({ data: result.recordset });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.post('/status/:formattedDate/:formattedTime/:id/:status', async (req, res) => {
    const id = req.params.id
    // const customer_id = req.params.customer_id
    const status = req.params.status

    //(status);

    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime

    //('order_id',order_id,'customer_id',customer_id);

    // const now = new Date();
    // const formattedDate = now.toISOString().split('T')[0]; // yyyy-mm-dd
    // const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    // const formattedTime = now.toLocaleTimeString([], options);
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('statementType', sql.NVarChar(255), 'OrderStatus');
        // request.input('customer_id', sql.Int, customer_id);
        request.input('id', sql.Int, id);
        request.input('status', sql.Int, status);
        const result = await request.execute('Sp_CustomerOrders');

        res.status(200).json({ success: true, message: 'success' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/postEventLogout/:formattedDate/:formattedTime/:user', async (req, res) => {
    const user = req.params.user
    //(user);
    // const now = new Date();
    // const formattedDate = now.toISOString().split('T')[0]; // yyyy-mm-dd
    // const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    // const formattedTime = now.toLocaleTimeString([], options);
    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('statementType', sql.NVarChar(255), 'Insert');
        request.input('description', sql.NVarChar(255), 'User Logout');
        request.input('DDate', sql.Date, formattedDate);
        request.input('TTime', sql.NVarChar(255), formattedTime);
        request.input('username', sql.NVarChar(255), user);
        request.input('EventType', sql.NVarChar(255), 'Logout');
        const result = await request.execute('Sp_Eventdetails');

        res.status(200).json({ success: true, message: 'success' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/updateCategoryOrderNo/:formattedDate/:formattedTime/:user_id/:user', async (req, res) => {
    const categoryANDorder = req.body

    const user_id = req.params.user_id
    const user = req.params.user
    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime
    //(categoryANDorder);

    // const now = new Date();
    // const formattedDate = now.toISOString().split('T')[0]; // yyyy-mm-dd
    // const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    // const formattedTime = now.toLocaleTimeString([], options);
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        for (const item of categoryANDorder) {
            const { category, value } = item;
            await request.query(
                `UPDATE Category SET order_no = ${value} WHERE category = '${category}'`
            );
        }

        request.input('statementType', sql.NVarChar(255), 'Insert');
        request.input('description', sql.NVarChar(255), 'Category Re-order Changed');
        request.input('DDate', sql.Date, formattedDate);
        request.input('TTime', sql.NVarChar(255), formattedTime);
        request.input('username', sql.NVarChar(255), user);
        request.input('UserID', sql.Int, user_id);
        const result = await request.execute('Sp_Eventdetails');

        res.status(200).json({ success: true, message: 'success' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// app.get('/getPaidStatus/:customer_id/:order_id', async (req, res) => {
//     const order_id = req.params.order_id
//     const customer_id = req.params.customer_id

//     try {
//         const poolConnect = await pool.connect();
//         const request = poolConnect.request();

//         request.input('customer_id', sql.Int, customer_id);
//         request.input('id', sql.Int, order_id);
//         request.input('status', sql.Int, 1);
//         const result = await request.query(`
//             SELECT status
//             FROM CustomerOrders
//             WHERE customer_id = @customer_id AND order_id = @id
//         `);

//         const data = result.recordset
//         res.status(200).json({ success: true, message: 'success',status:data });
//     } catch (error) {
//         console.error('Error:', error.message);
//         res.status(500).json({ success: false, message: 'Internal server error' });
//     }
// });

app.get('/deleteOrder/:formattedDate/:formattedTime/:Data/:user_id/:input/:user', async (req, res) => {
    const Data = JSON.parse(req.params.Data);
    const user_id = req.params.user_id
    const formattedDate = req.params.formattedDate
    const formattedTime = req.params.formattedTime
    const user = req.params.user
    const reason = req.params.input
    //(user_id);
    //(user);

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        request.input('statementType', sql.NVarChar(255), 'DeleteCustomerOrder');
        request.input('customer_id', sql.Int, Data.customer_id);
        request.input('id', sql.Int, Data.order_id);
        request.input('event', sql.NVarChar(255), Data.event);
        request.input('DDate', sql.Date, Data.currentDate);
        request.input('TTime', sql.NVarChar(255), Data.currentTime);
        request.input('username', sql.NVarChar(255), user);
        request.input('user_id', sql.Int, user_id);
        if (reason) {
            request.input('reason', sql.NVarChar(255), `: ${reason}`);
        }
        const result = await request.execute('Sp_CustomerOrders');

        // //("categories",result.recordset);
        res.status(200).json({ success: true});

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getCustomerStatus/:id', async (req, res) => {
    const id = req.params.id
    // const deliveryDate = req.params.deliveryDate

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('id', sql.Int, id);
        // request.input('deliveryDate', sql.Date, deliveryDate);
        const result = await request.query(`
            SELECT status
            FROM CustomerOrders
            WHERE id = @id
        `);
        const data = result.recordset
        // //("categories",result.recordset);
        res.status(200).json({ success: true , status : data});

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getCategories', async (req, res) => {
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        const result = await request.query(`
            SELECT * 
            FROM Category
        `);
        const data = result.recordset
        // //("categories",result.recordset);
        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getUserGroup', async (req, res) => {
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        const result = await request.query(`
            SELECT user_id,under
            FROM UserRights
        `);
        const data = result.recordset
        // //("categories",result.recordset);
        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getRights/:user', async (req, res) => {
    const user = req.params.user
    //(user);
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        request.input('user', sql.NVarChar(255), user);
        const result = await request.query(`
            SELECT *
            FROM UserRights
            WHERE under = @user
        `);
        const data = result.recordset
        //(data);
        // //("categories",result.recordset);
        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

const formatDate = (dateString) => {
    const [day, month, year] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

const reformatDate = (dateStr) => {
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
  }

app.get('/getCustomerDetails/:deliveryDate', async (req, res) => {
    const deliveryDate = reformatDate(req.params.deliveryDate)
    //(deliveryDate);
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        request.input('statementType', sql.NVarChar(255), 'GetCustomerOrders');
        request.input('deliveryDate', sql.NVarChar(255), deliveryDate);

        const result = await request.execute('Sp_CustomerOrders');
        const data = result.recordset

        //(data);

        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getCustomerOrders/:customer', async (req, res) => {
    const {id , customerName, deliveryDate} = JSON.parse(req.params.customer)
    const date = reformatDate(deliveryDate)
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        request.input('statementType', sql.NVarChar(255), 'GetCustomerOrdersDetails');
        request.input('deliveryDate', sql.Date, date);
        request.input('customer_id', sql.Int, id);

        const result = await request.execute('Sp_CustomerOrders');
        const data = result.recordset
        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getCustomerOrdersToGraph/:id', async (req, res) => {
    const id = req.params.id

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        request.input('customer_id', sql.Int, id);
        const result = await request.query(`
            SELECT order_id, orderDate, orderTime, status, paid_unpaid
            FROM CustomerOrders
            WHERE customer_id = @customer_id
        `);
        const data = result.recordset

        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getFullOrders', async (req, res) => {
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        const result = await request.query(`
            SELECT 
                co.customer_id, 
                co.orderDate, 
                co.orderTime, 
                co.status, 
                co.paid_unpaid, 
                cd.customerName
            FROM 
                CustomerOrders co
            LEFT JOIN 
                customerDetails cd ON co.customer_id = cd.customer_id
            ORDER BY 
                co.id DESC -- or co.order_id DESC if available
        `);
        
        // Map through the result to include the customer name
        const data = result.recordset;

        res.status(200).json({ data });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});



app.get('/getOrderDate', async (req, res) => {
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        const result = await request.query(`
            SELECT 
                co.*,
                cd.customerName,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM CustomerOrders 
                        WHERE deliveryDate = co.deliveryDate 
                        AND status = 0
                    )
                    THEN 0 
                    ELSE 1 
                END AS status
            FROM 
                CustomerOrders co
            JOIN 
                CustomerDetails cd ON co.customer_id = cd.customer_id
            ORDER BY 
                co.id DESC  -- Ordering by 'Auto' in descending order
        `);
        const data = result.recordset;
        //(data);
        res.status(200).json({ data });
        
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.get('/getOrderedItemDetails/:customer_id/:order_id', async (req, res) => {
    const customer_id = req.params.customer_id;
    const order_id = req.params.order_id;
    //(order_id);
    
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        request.input('customer_id', sql.Int, customer_id);
        request.input('order_id', sql.Int, order_id);
        
        // Query for order details
        const orderDetailsResult = await request.query(`
            SELECT *
            FROM OrderDetails
            WHERE customer_id = @customer_id AND order_id = @order_id
        `);
        
        // Query for customer details
        const customerDetailsResult = await request.query(`
            SELECT *
            FROM CustomerDetails
            WHERE customer_id = @customer_id
        `);

        // Query for status
        const statusResult = await request.query(`
            SELECT paid_unpaid
            FROM CustomerOrders
            WHERE customer_id = @customer_id AND order_id = @order_id
        `);

        const orderDetails = orderDetailsResult.recordset;
        const customerDetails = customerDetailsResult.recordset[0]; // Assuming one customer detail
        const status = statusResult.recordset[0];

        //(status);
        
        res.status(200).json({ orderDetails, customerDetails, status });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.get('/getFilteredItems/:category', async (req, res) => {
    const category = req.params.category;
    //("Category parameter:", category);

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        request.input('category', sql.NVarChar(255), category);
        const result = await request.query(`
            SELECT * 
            FROM ItemReg WHERE category = @category
        `);
        const data = result.recordset
        //("items",data);
        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getCustomer', async (req, res) => {

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        const result = await request.query(`
            SELECT customer_id , customerName 
            FROM CustomerDetails
        `);

        // Transform the data to the desired format
        const transformedData = result.recordset.map(customer => ({
            value: customer.customer_id,
            label: customer.customerName
        }));

        //("cust",transformedData);
        res.status(200).json({ data :transformedData  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getEvents', async (req, res) => {
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        const result = await request.query(`
            SELECT DISTINCT event
            FROM CustomerOrders
        `);

        const transformedData = result.recordset.map((order,index) => ({
            value: index+1,
            label: order.event
        }));

        res.status(200).json({ data :transformedData  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.get('/getCustomerInfo/:id', async (req, res) => {
    const customer_id = req.params.id
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        const result = await request.query(`
            SELECT place,mobile
            FROM CustomerDetails
            WHERE customer_id = ${customer_id}
        `);

        const data = result.recordset

        //("data",data);
        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getDistinctCategories/:customer_id/:order_id', async (req, res) => {
    const customer_id = req.params.customer_id;
    const order_id = req.params.order_id;

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        request.input('statementType', sql.NVarChar(255), 'GetCategories');
        request.input('customer_id', sql.Int, customer_id);
        request.input('order_id', sql.Int, order_id);

        const result = await request.execute('Sp_PDF');

        // //(result);

        const data = result.recordset
        
        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/getItemsOnCategories/:customer_id/:order_id/:category', async (req, res) => {
    const customer_id = req.params.customer_id;
    const order_id = req.params.order_id;
    const category = req.params.category;

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        request.input('statementType', sql.NVarChar(255), 'GetItemsOnCategory');
        request.input('customer_id', sql.Int, customer_id);
        request.input('order_id', sql.Int, order_id);
        request.input('category', sql.NVarChar(255), category);

        const result = await request.execute('Sp_PDF');

        // //(result);

        const data = result.recordset

        //("data",data);
        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/pdfCompressAndSave', async (req, res) => {
    const pdf = req.body
    //(pdf);
    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        res.status(200).json({ success: true, message: 'success' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/modifyItem/:ID', async (req, res) => {
    const productID = req.params.ID;

    try {
        const poolConnect = await pool.connect();
        const request = poolConnect.request();
        request.input('productID', sql.NVarChar(255), productID);
        const result = await request.query(`
            SELECT * 
            FROM ItemReg WHERE id = @productID
        `);
        
        const data = result.recordset
        //("item:",data);
        res.status(200).json({ data :data  });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/insertCustomerOrder/:user_id/:user', async (req, res) => {
    const customerOrderAndItems = req.body;
    const user_id = req.params.user_id;
    const user = req.params.user;

    // console.log(user_id,user);

    const {
        items,
        customerName,
        deliveryDate,
        place,
        mobile,
        event,
        totalMembers,
        deliveryTime,
        currentTime,
        currentDate
    } = customerOrderAndItems;

    // Split deliveryDate and create Date object
    const [day, month, year] = deliveryDate.split('-');
    const jsDeliveryDate = new Date(`${year}-${month}-${day}`);
    if (isNaN(jsDeliveryDate)) {
        throw new Error('Invalid delivery date format');
    }
    const formattedDeliveryDate = jsDeliveryDate.toISOString().split('T')[0];

    // Split currentDate and create Date object
    const [currentDay, currentMonth, currentYear] = currentDate.split('-');
    const jsCurrentDate = new Date(`${currentYear}-${currentMonth}-${currentDay}`);
    if (isNaN(jsCurrentDate)) {
        throw new Error('Invalid current date format');
    }
    const formattedCurrentDate = jsCurrentDate.toISOString().split('T')[0];

    // Check if customerName is a number or a string
    const isCustomerNameNumber = !isNaN(Number(customerName));
    const isCustomerNameString = typeof customerName === 'string';
    try {
        
        // Connect to the database
        const poolConnect = await pool.connect();
        const request = poolConnect.request();

        let result;
        if (isCustomerNameNumber) {
            
            const query = `
                UPDATE CustomerDetails
                SET place = @place, mobile = @mobile
                WHERE customer_id = @customer_id;
            `;
            request.input('place', sql.NVarChar(255), place);
            request.input('mobile', sql.Numeric(18,0), mobile);
            
            // Create a table variable to pass the items
            const itemsTable = new sql.Table('OrdersType');
            itemsTable.create = false;
            itemsTable.columns.add('item_id', sql.Int);
            itemsTable.columns.add('itemName', sql.NVarChar, { length: 255 });
            itemsTable.columns.add('quantity', sql.Int);
            itemsTable.columns.add('total', sql.Int);
            // Populate the table variable with the items
            items.forEach((item,index) => {
                itemsTable.rows.add(index+1, item.itemName, item.qty, item.total ? item.total : item.rate);
            });

            result = await request
            .input('statementType', sql.NVarChar, 'CustomerOrders')
            .input('customer_id', sql.Int, customerName)
            .input('deliveryDate', sql.Date, formattedDeliveryDate)
            .input('deliveryTime', sql.NVarChar(255), deliveryTime)
            .input('TTime', sql.NVarChar(255), currentTime)
            .input('DDate', sql.Date, formattedCurrentDate)
            .input('event', sql.NVarChar, event)
            // .input('des', sql.VarChar(250), 'Order Proccessed')
            .input('totalMembers', sql.Int, parseInt(totalMembers))
            .input('user_id', sql.Int, user_id)
            // .input('name', sql.NVarChar(255), customerName)
            .input('username', sql.NVarChar(255), user)
            .input('Items', sql.TVP('OrdersType'), itemsTable)
            .execute('Sp_CustomerOrders');

            await request.query(query);

        } else if (isCustomerNameString) {

            // Create a table variable to pass the items
            const itemsTable = new sql.Table('OrdersType');
            itemsTable.create = false;
            itemsTable.columns.add('item_id', sql.Int);
            itemsTable.columns.add('itemName', sql.NVarChar, { length: 255 });
            itemsTable.columns.add('quantity', sql.Int);
            itemsTable.columns.add('total', sql.Int);
            // Populate the table variable with the items
            items.forEach((item,index) => {
                itemsTable.rows.add(index+1, item.itemName, item.qty, item.total ? item.total : item.rate);
            });

            result = await request
            .input('statementType', sql.NVarChar, 'CustomerReg')
            .input('customerName', sql.NVarChar, customerName)
            .input('deliveryDate', sql.Date, formattedDeliveryDate)
            .input('deliveryTime', sql.NVarChar(255), deliveryTime)
            .input('place', sql.NVarChar, place)
            .input('orderTime', sql.NVarChar(255), currentTime)
            .input('orderDate', sql.Date, formattedCurrentDate)
            .input('mobile', sql.Numeric(18, 0), mobile)
            .input('event', sql.NVarChar, event)
            .input('des', sql.VarChar(250), 'Order Proccessed')
            .input('user_id', sql.Int, user_id)
            .input('username', sql.NVarChar(255), user)
            .input('totalMembers', sql.Int, parseInt(totalMembers))
            .input('Items', sql.TVP('OrdersType'), itemsTable)
            .execute('Sp_CustomerReg');
        }

        // const order_id = result.recordset[0].order_id;

        // Insert into Orders table using the retrieved order_id
        // await request
        //     .input('order_id', sql.Int, order_id)
        //     .input('Items', sql.TVP('OrdersType'), itemsTable)
        //     .execute('InsertOrderAndItems');
        // Release the connection
        poolConnect.release();

        io.emit('OrdersUpdated', { success: true });
        res.status(200).json({ success: true, message: 'Order and items inserted successfully' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// io.on('connection', (socket) => {
//     console.log('A user connected');
  
//     socket.on('signal', (data) => {
//       // Broadcast the signal data to other users
//       socket.broadcast.emit('signal', data);
//     });
  
//     socket.on('disconnect', () => {
//       console.log('A user disconnected');
//     });
//   });
  
//   server.listen(4000, () => {
//     console.log('Server listening on port 4000');
//   });

const PORT = process.env.PORT;
httpServer.listen(PORT, () => {
    (`Server running on port ${PORT}`);
});