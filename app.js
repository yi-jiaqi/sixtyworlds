/*
Configuration: 
    pro(production) / dev(development)
    # Development
    pm2 start ecosystem.config.js --env dev

    # Production
    pm2 start ecosystem.config.js --env pro
*/
const CONFIG = {
    dev: {  // matches NODE_ENV=dev from package.json
        port: 3001,
        baseUrl: 'http://localhost:3001',
        protocol: 'http',
        domain: 'localhost:3001'
    },
    pro: {  // matches NODE_ENV=pro from package.json
        port: 3001,
        baseUrl: 'https://sixtyworlds.com',
        protocol: 'https',
        domain: 'sixtyworlds.com'
    }
};

// fallback for environment and config
const ENV = process.env.NODE_ENV || 'dev';
const currentConfig = CONFIG[ENV] || CONFIG.dev;



const BASE_URL = 'https://sixtyworlds.com';
const express = require('express');
const session = require('express-session');
const { Issuer, generators } = require('openid-client');
const app = express();
const bodyParser = require('body-parser');
const db = require('./db');
app.use(express.text({ type: 'text/*' }));  // Ensure that it handles any text content, including CSV
app.use(express.json());
app.use(bodyParser.json());
const path = require('path');
const cors = require('cors');//Jiaqis-MacBook-Pro.local
app.use(cors({
    origin: ['http://localhost:3001', 'http://jiaqis-macbook-pro.local:3001'],
    credentials: true,
  }));
const csv = require('csv-parser');
const fs = require('fs');
const { PassThrough } = require("stream");
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { fromEnv } = require('@aws-sdk/credential-provider-env');
const { fromNodeProviderChain } = require('@aws-sdk/credential-providers');
const { middlewareRetry } = require('@aws-sdk/middleware-retry');
// const { middlewareRetry } = require('@smithy/middleware-retry ');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();
const s3 = new S3Client({
    region: 'us-east-2', // Replace with your region
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
// console.log(process.env.AWS_ACCESS_KEY_ID)
// console.log(process.env.AWS_SECRET_ACCESS_KEY)
const csvFilePath_Worlds = 'worlds.csv'
const csvFilePath_Authors = 'authors.csv'
const destination_login = `${BASE_URL}/callback`
const previewBucket = 'sixtyworlds-previews'
const modelBucket = 'sixtyworlds-models'
/*
   ###
  ####
 ## ##
    ##
    ##
    ##
 #########
AWS Cognito
*/

let client;
// Initialize OpenID Client
async function initializeClient() {
    const issuer = await Issuer.discover('https://cognito-idp.us-east-2.amazonaws.com/us-east-2_ArF7gdgij');
    client = new issuer.Client({
        client_id: 'igqvrbfgkacjbh81g2a7vfse4',
        client_secret: '1pcu8m1c24euu2nakqe68ofvv5aama9fmqbl6ksukt5euloeng6b',
        redirect_uris: [
            'http://localhost:3001/callback',
            'https://sixtyworlds.com/callback'
        ],
        response_types: ['code']
    });
}

initializeClient().catch(console.error);

// Add logging middleware at the top of your routes
app.use((req, res, next) => {
 // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(session({
    secret: 'some secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

const checkAuth = (req, res, next) => {
    // console.log("checkAuth")
    if (!req.session.userInfo) {
        req.isAuthenticated = false;
    } else {
        req.isAuthenticated = true;
    }
    next();
};

app.get('/', checkAuth, (req, res) => {
    // console.log("/, checkAuth")
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/api/user-state', (req, res) => {
    const isAuthenticated = !!req.session.userInfo;
    res.json({
        isAuthenticated,
        userInfo: isAuthenticated ? req.session.userInfo : null,
    });
});

// Update the callback route with more detailed logging
app.get('/callback', async (req, res) => {
    // console.log('\n[Callback] Starting authentication...');
    // console.log('[Callback] Query parameters:', req.query);
    // console.log('[Callback] Session state:', {
    //     nonce: req.session?.nonce,
    //     state: req.session?.state
    // });

    try {
        const params = client.callbackParams(req);
        // console.log('[Callback] Parsed OAuth params:', params);

        const redirectUri = `${currentConfig.protocol}://${currentConfig.domain}/callback`;
   
        console.log('[Callback] Using redirect URI:', redirectUri);

        if (!req.session?.nonce || !req.session?.state) {
            throw new Error('Missing session data');
        }

        const tokenSet = await client.callback(
            redirectUri,
            params,
            {
                nonce: req.session.nonce,
                state: req.session.state
            }
        );
        // console.log('[Callback] Received token set');

        const userInfo = await client.userinfo(tokenSet.access_token);
        // console.log('[Callback] Received user info:', userInfo.sub);

        req.session.userInfo = userInfo;
        req.session.isAuthenticated = true;

        // console.log('[Callback] Authentication successful, redirecting to home');
        res.redirect('/');
    } catch (err) {
        console.error('[Callback] Authentication error:', {
            name: err.name,
            message: err.message,
            stack: err.stack
        });
        res.redirect('/?error=' + encodeURIComponent(err.message));
    }
});

// Add helper function for author registration
async function handleAuthorRegistration(userInfo) {
    const nickname = userInfo.nickname || "No nickname provided";
    const author_uid = userInfo.sub;

    return new Promise((resolve, reject) => {
        let stream = fs.createReadStream(csvFilePath_Authors).pipe(csv());
        let isUIDFound = false;

        stream
            .on('data', (data) => {
                if (data.UID === author_uid) {
                    isUIDFound = true;
                    // console.log("[Author] UID found:", author_uid);
                }
            })
            .on('end', async () => {
                if (!isUIDFound) {
                    try {
                        const newRow = `\n${nickname},${author_uid}`;
                        await fs.promises.appendFile(csvFilePath_Authors, newRow, "utf8");
                        // console.log("[Author] Registered new author:", author_uid);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    resolve();
                }
            })
            .on('error', reject);
    });
}

// Update the login route with better error handling
app.get('/login', async (req, res) => {
    console.log('[Login] Starting login process');
    
    // Check if client is initialized
    if (!client) {
        console.error('[Login] OpenID Client not initialized');
        return res.status(500).send('Authentication service not ready');
    }

    const nonce = generators.nonce();
    const state = generators.state();
    
    // Determine environment and set protocol accordingly
    const redirectUri = `${currentConfig.protocol}://${currentConfig.domain}/callback`;
   
    
    console.log('[Login] Using redirect URI:', redirectUri);
    console.log('[Login] Client config:', {
        redirectUris: client.metadata.redirect_uris,
        clientId: client.metadata.client_id
    });

    // Check redirect URI against allowed URIs
    if (!client.metadata.redirect_uris?.includes(redirectUri)) {
        console.error('[Login] Invalid redirect URI:', redirectUri);
        console.error('[Login] Allowed URIs:', client.metadata.redirect_uris);
        return res.status(400).send('Invalid redirect URI configuration');
    }

    req.session.nonce = nonce;
    req.session.state = state;

    try {
        const authUrl = client.authorizationUrl({
            scope: 'phone openid email profile',
            state: state,
            nonce: nonce,
            redirect_uri: redirectUri
        });

        console.log('[Login] Redirecting to Cognito:', authUrl);
        res.redirect(authUrl);
    } catch (error) {
        console.error('[Login] Error generating auth URL:', error);
        res.status(500).send('Error during authentication');
    }
});

// Helper function to get the path from the URL. Example: "http://localhost/hello" returns "/hello"
function getPathFromURL(urlString) {
    // console.log("getPathFromURL:"+urlString)
    try {
        const url = new URL(urlString);
        return url.pathname;
    } catch (error) {
        console.error('Invalid URL:', error);
        return null;
    }
}

app.get(getPathFromURL(destination_login), async (req, res) => {

    try {
        const params = client.callbackParams(req);
        const tokenSet = await client.callback(
            destination_login,
            params,
            {
                nonce: req.session.nonce,
                state: req.session.state
            }
        );

        const userInfo = await client.userinfo(tokenSet.access_token);
        req.session.userInfo = userInfo;

        res.redirect('/');
    } catch (err) {
        console.error('Callback error:', err);
        res.redirect('/');
    }
});


// Logout route
app.get('/logout', (req, res) => {
    /*
    Seems need to be updated from localhost to sixtyworlds
    */
    req.session.destroy();
    const logoutUrl = `https://us-east-2arf7gdgij.auth.us-east-2.amazoncognito.com/logout?client_id=igqvrbfgkacjbh81g2a7vfse4&logout_uri=${BASE_URL}`;
    res.redirect(logoutUrl);
});


// app.set('view engine', 'ejs');
app.listen(currentConfig.port, () => {
    const serverStartTime = new Date().toISOString();
    
    console.log(`
    ╔════════════════════════════════════════╗
    ║          SIXTY WORLDS SERVER           ║
    ╚════════════════════════════════════════╝
    
    🚀 Server Status
    ----------------
    Time     : ${serverStartTime}
    Port     : ${currentConfig.port}
    URL      : ${currentConfig.baseUrl}
    Mode     : ${ENV}
    
    📡 API Endpoints Ready
    ---------------------
    - Auth   : /login, /callback, /logout
    - Data   : /api/comments, /api/getPreviews
    - Models : /api/getModel, /api/uploadWorld
    
    ⚡ Server is running and ready for connections
    `);
});

/*
   #####
  ##   ##
       ##
      ##
    ##
   ##
  #########
Endpoint - getPreviews
*/


app.get('/api/getPreviews', async (req, res) => {
    const index = parseInt(req.query.index) || 0; // Start line number
    const number = parseInt(req.query.number) || 9; // Number of lines to read
    const sort = req.query.sort || 'time'; // sort can be 'time' / 'likes' / 'author' / 'search'
    const word = req.query.word; // If sort is 'author', word is the UID
    if (sort == "author") {
     // console.log("get previews with UID: " + word)
    } else {
     // console.log("get previews by: " + sort)
    }

    // Verify the CSV file exists
    if (!fs.existsSync(csvFilePath_Worlds)) {
        console.error('Error: CSV file not found at path:', csvFilePath_Worlds);
        return res.status(404).json({ error: 'CSV file not found' });
    }

    try {
        let stream;
        // Check if we're filtering by author UID
        if (sort === 'author' && word) {
            const author_UID = word
            stream = await filterByAuthorUID(author_UID);
        } else {
            stream = fs.createReadStream(csvFilePath_Worlds).pipe(csv());
        }

        const results = [];
        let currentLine = 0;

        stream
            .on('data', (data) => {
                // Start reading from the specified index
                if (currentLine < index) {
                    currentLine++;
                    return;
                }

                // Add only the specified number of results
                if (results.length < number) {
                    results.push(data);
                }

                currentLine++;
            })
            .on('end', async () => {
                if (results.length === 0) {
                 // console.log('End of the Worlds: No more data to load');
                    return res.json([{ isEnd: true }]);
                }

                const paginatedResults = await Promise.all(
                    results.map(async (item) => {
                        const previewImageKey = `${item.author_uid}-${item.serial}`;
                        const previewImageUrl = await generatePresignedUrl(0, previewBucket, previewImageKey);
                        const serial = item.serial;
                        const authorName = await getAuthorName(item.author_uid)
                        // const authorName = "test"
                        return {
                            ...item,
                            author_name: authorName,
                            preview_url: previewImageUrl,
                            serial: serial,

                        };
                    })
                );

                const totalLines = currentLine;
                const isEndReached = index + number >= totalLines;

                // Add end marker if at the end
                if (isEndReached) {
                    paginatedResults.push({ isEnd: true });
                }

                res.json(paginatedResults);
            })
            .on('error', (error) => {
                console.error('Error reading CSV file:', error);
                res.status(500).json({ error: 'Error reading CSV file' });
            });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Error processing request' });
    }
});


async function filterByAuthorUID(author_UID) {
 // console.log("trying to filter: " + author_UID)
    const passThrough = new PassThrough({ objectMode: true });

    fs.createReadStream(csvFilePath_Worlds)
        .pipe(csv())
        .on("data", (data) => {
            if (data.author_uid === author_UID) {
                // console.log("found one!")
                passThrough.write(data); // Write matching rows to the stream
            } else {

             // console.log(data.author_uid)
            }
        })
        .on("end", () => {
            passThrough.end(); // End the stream after processing
        })
        .on("error", (error) => {
            console.error("Error reading CSV file:", error);
            passThrough.destroy(error); // Destroy the stream on error
        });
    // console.log(passThrough)
    return passThrough; // Return the filtered stream
}

/*
   #####
  ##   ##
       ##
    ####
       ##
  ##   ##
   #####
Endpoint - updateAuthor + getAuthorName [NO LONGER NEEDED]
*/
const getAuthorName = async (uid) => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(csvFilePath_Authors)
            .pipe(csv())
            .on('data', (data) => {
                if (data.UID === uid) {
                    resolve(data.author_name); // Resolve with the author_name if UID is found
                    // console.log("Found author name: " + data.author_name)
                } else {
                    results.push(data); // Continue accumulating data for error checking
                }
            })
            .on('end', () => {
                reject(new Error('UID not found')); // Reject if UID was not found after reading all rows
            })
            .on('error', (error) => reject(new Error(`Error reading CSV file: ${error.message}`))); // Handle read errors
    });
};
app.post('/api/updateAuthor', (req, res) => {
    const { displayName, userId } = req.body;

 // console.log("displayName: " + displayName)
 // console.log("userId: " + userId)

    // Read and parse the CSV file
    const authors = [];
    fs.createReadStream(csvFilePath_Authors)
        .pipe(csv())
        .on('data', (row) => {
            authors.push(row);
            // console.log(row)
        })
        .on('end', () => {
            let userFound = false;

            // Check if the UID exists
            for (let author of authors) {
                if (author.UID === userId) {
                    author.author_name = displayName; // Update the author_name
                    userFound = true;
                    break;
                }
            }

            if (!userFound) {
                // Add a new line if UID is not found
                authors.push({ author_name: displayName, UID: userId });
            }

            // Write the updated data back to the CSV file, ensuring the header is preserved
            const updatedCSV = [header, ...authors.map(author => `${author.author_name},${author.UID}`)].join('\n');
            fs.writeFile(csvFilePath_Authors, updatedCSV, (err) => {
                if (err) {
                    console.error("Error updating CSV file:", err);
                    res.status(500).send({ error: "Failed to update the CSV file." });
                } else {
                 // console.log("CSV file updated successfully.");
                    res.status(200).send({ success: true });
                }
            });
        })
        .on('error', (error) => {
            console.error("Error reading CSV file:", error);
            res.status(500).send({ error: "Failed to read the CSV file." });
        });
});
app.get('/api/getAuthorName/:uid', async (req, res) => {
    const uid = req.params.uid;
    try {
        const data = await readAuthorCSV();
        const entry = data.find((row) => row.UID === uid);
        if (entry) {
            res.json({ author_name: entry.author_name });
        } else {
            res.status(404).json({ error: 'UID not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error reading CSV file' });
    }
});
app.get('/api/getAuthorUID/:serial', async (req, res) => {
    const serial = req.params.serial;
 // console.log("Trying to get author UID by serial: " + serial)
    getItembySerial(serial)
        .then(async (data) => {
         // console.log("Resolved project:", data.model_name);

            const authorName = await getAuthorName(data.author_uid)
            data.author_name = authorName
            if (data && data.author_uid) {
                res.status(200).json(data);
            } else {
                res.status(404).json({ error: "No data found for the provided serial." });
            }
        })
        .catch((error) => {
            console.error("Error resolving getItembySerial:", error.message);
            res.status(500).json({ error: "Error resolving serial data" });
        });
});

function getItembySerial(lineNumber) {
 // console.log("getItembySerial: " + lineNumber)
    return new Promise((resolve, reject) => {
        let currentLine = 0; // Track the current line
        const targetLine = Number(lineNumber) + 2; // Calculate the target line
        let result = null;

        // Create a readable stream to process the CSV
        fs.createReadStream(csvFilePath_Worlds)
            .pipe(csv()) // Use csv-parser to parse the file
            .on("data", (data) => {
                currentLine++;
                // console.log(data)
                if (currentLine == targetLine) {
                    result = data; // Store the matching row
                }
            })
            .on("end", () => {
                if (result) {
                    resolve(result); // Resolve with the matching row as an object
                    // console.log(result)
                } else {
                    reject(
                        new Error(
                            `No data found at line ${targetLine}. Check the file length.`
                        )
                    );
                }
            })
            .on("error", (error) => {
                reject(new Error("Error reading CSV file: " + error.message));
            });
    });
}




/*
     ##
    ###
   # ##
  #  ##
 #######
     ##
     ##
Endpoint - getModel
*/


app.get('/api/getModel/:serial', async (req, res) => {
    const modelSerial = req.params.serial; // Serial to find
 // console.log("Trying to get the model by serial: " + modelSerial);

    // Verify the CSV file exists
    if (!fs.existsSync(csvFilePath_Worlds)) {
        console.error('Error: CSV file not found at path:', csvFilePath_Worlds);
        return res.status(404).json({ error: 'CSV file not found' });
    }

    try {
        const stream = fs.createReadStream(csvFilePath_Worlds).pipe(csv());
        let isResponded = false; // Ensure only one response is sent

        stream
            .on('data', async (data) => {
                // console.log('Parsed Row:', data);

                // Check if the serial matches
                if (data.serial === modelSerial) {
                    // console.log("get model -> csv -> match found");ç
                    stream.destroy(); // Stop reading the CSV file

                    try {
                        const model_url = await generatePresignedUrl(1, modelBucket, modelSerial);
                        // console.log("Successfully generated " + model_url);

                        const authorName = await getAuthorName(data.author_uid)
                     // console.log(data)
                        data.author_name = authorName
                        data.model_url = model_url;
                        if (!isResponded) {
                            isResponded = true; // Prevent duplicate responses
                            return res.json(data); // Send the response immediately
                        }
                    } catch (error) {
                        console.error('Error generating pre-signed URL:', error);
                        if (!isResponded) {
                            isResponded = true;
                            res.status(500).json({ error: 'Error generating pre-signed URL' });
                        }
                    }
                }
            })
            .on('end', () => {
                if (!isResponded) {
                 // console.log('Item not found with the provided serial');
                    res.status(404).json({ error: 'Item not found' });
                }
            })
            .on('error', (error) => {
                console.error('Error reading CSV file:', error);
                if (!isResponded) {
                    isResponded = true;
                    res.status(500).json({ error: 'Error reading CSV file' });
                }
            });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Error processing request' });
    }
});



/*
  #######
  ##
  ##
  ######
       ##
  ##   ##
   #####
AWS S3 - Preasssinged URLs + findFileKey
*/
async function generateUploadUrl(type, bucket, baseKey) {  // type: 0=>Preview; 1=>Models
    try {
        // Determine file extension based on type
        const extension = type === 0 ? '.jpeg' : '.glb';
        const key = `${baseKey}${extension}`;

        // Create the command for the upload presigned URL
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: type === 0 ? 'image/jpeg' : 'model/gltf-binary'
        });

        // Generate the presigned URL (5 minutes expiry)
        const url = await getSignedUrl(s3, command, { expiresIn: 300 });
        return url;
    } catch (error) {
        console.error(`Error generating upload URL for ${bucket}/${baseKey}:`, error);
        return null;
    }
}

async function generatePresignedUrl(type, bucket, baseKey) {//type: 0=>Preview; 1=>Models
    try {

        let key = await findFileKey(type, bucket, baseKey);
        // console.log(key)
        // Create the command for the presigned URL
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        // Generate the presigned URL (5 minutes expiry)
        const url = await getSignedUrl(s3, command, { expiresIn: 300 });
        return url;
    } catch (error) {
        console.error(`Error finding file with type ${bucket} and base key ${baseKey}:`, error);
        return null;
    }
}


async function findFileKey(type, bucket, baseKey) {

    let possibleExtensions = type === 1 ? ['.glb', '.gltf'] : type === 0 ? ['.jpeg', '.jpg', '.png'] : undefined;
    // console.log(possibleExtensions)
    for (let ext of possibleExtensions) {
        const key = `${baseKey}${ext}`;
        // console.log(key)
        try {
            // Check if the file exists in S3
            const command = new HeadObjectCommand({
                Bucket: bucket,
                Key: key,
            });
            await s3.send(command); // If no error, file exists
            return key;
        } catch (error) {
            if (error.name === 'NotFound') {
                // console.log(`Key not found: ${key}`);
                continue; // Try the next extension
            } else {
                throw error; // Rethrow other unexpected errors
            }
        }
    }
    // Throw an error if none of the extensions match
    throw new Error(`File not found with base key: ${baseKey}`);
}




/*
   #####
  ##
  ##
  ######
  ##   ##
  ##   ##
   #####
Managing the csv file locally
*/
app.post('/upload-model', async (req, res) => {
    const jsonData = req.body;

    // Validate and normalize JSON data
    const csvData = headers.reduce((result, header) => {
        result[header] = jsonData[header] || 'placeholder'; // Use placeholder if property is missing
        return result;
    }, {});

    // Write data to CSV
    try {
        const csvStream = csvWriter({
            path: csvFilePath,
            header: headers.map((header) => ({ id: header, title: header })),
            append: true,
        });

        await csvStream.writeRecords([csvData]);

        // Generate a pre-signed URL
        const params = {
            Bucket: 'your-s3-bucket-name', // Replace with your bucket name
            Key: `uploads/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`, // Unique file name
            Expires: 60 * 60, // URL valid for 1 hour
        };

        const uploadUrl = s3.getSignedUrl('putObject', params);

        res.status(200).json({
            message: 'JSON saved and pre-signed URL generated successfully!',
            uploadUrl,
        });
    } catch (error) {
        console.error('Error handling JSON:', error);
        res.status(500).json({ error: 'Failed to process the JSON' });
    }
});

/*
  #########
       ##
      ##
     ##
    ##
   ##
  ##
Comment with a position
*/

async function getNextSerial() {
    return new Promise((resolve, reject) => {
        let lineCount = 0;
        const rl = require('readline').createInterface({
            input: fs.createReadStream(csvFilePath_Worlds),
            crlfDelay: Infinity
        });

        rl.on('line', () => {
            lineCount++;
        });

        rl.on('close', () => {
            // Since lineCount includes header row, it's already the next serial number
            resolve((lineCount - 1).toString()); // Subtract 1 to account for header
        });

        rl.on('error', (err) => {
            reject(err);
        });
    });
}

app.post('/api/uploadWorld', async (req, res) => {
    const config = req.body;
    let newSerial;

    try {
        // 1-1. Check/Update authors.csv
        const authorsStream = fs.createReadStream(csvFilePath_Authors).pipe(csv());
        let authorExists = false;

        await new Promise((resolve, reject) => {
            authorsStream
                .on('data', (row) => {
                    if (row.UID === config.author_uid) {
                        authorExists = true;
                    }
                })
                .on('end', async () => {
                    if (!authorExists) {
                        const newAuthorRow = `\n${config.author_name},${config.author_uid}`;
                        await fs.promises.appendFile(csvFilePath_Authors, newAuthorRow);
                    }
                    resolve();
                })
                .on('error', reject);
        });

        // 1-2. Add new entry to worlds.csv
        // First, get the last serial number
        newSerial = await getNextSerial();
        const currentDate = new Date().toISOString().split('T')[0];
        const newWorldRow = `\n${newSerial},${config.model_name},${config.author_uid},${currentDate},${config.configuration},${config.keywords},${config.likes}`;
        await fs.promises.appendFile(csvFilePath_Worlds, newWorldRow);

        let previewName = `${config.author_uid}-${newSerial}`;
        // 2. Generate presigned URL for preview upload
        const paURL_preview = await generateUploadUrl(0, previewBucket, previewName);

        // 3. Generate presigned URL for model upload
        const paURL_model = await generateUploadUrl(1, modelBucket, newSerial);


        // 4. Send response
        res.json({
            paURL_preview,
            paURL_model,
            serial: newSerial
        });

    } catch (error) {
        console.error('Error in /api/uploadWorld:', error);
        res.status(500).json({ error: 'Failed to process upload request' });
    }
});

/*
   #####
  ##   ##
  ##   ##
   #####
  ##   ##
  ##   ##
   #####
Save & Give Trace data
*/

app.post('/save-camera-data', (req, res) => {
    // Log the raw content of the request body as soon as it's received
    // console.log('Received raw data:', req.body);

    let csvData = req.body;

    // Check if the received data is a string
    if (typeof csvData !== 'string') {
        console.error('Error: Data received is not a string:', csvData);
        return res.status(400).send('Invalid data format: Expected a string.');
    }

    // Get the current date and time for the file name
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().replace(/[:.]/g, '-');

    // Define the path to save the CSV file
    const filePath = path.join(__dirname, 'path', `camera_data_${formattedDate}.csv`);

    // Log the path for saving the CSV file
 // console.log('Saving CSV file to:', filePath);

    // Write the CSV data to a file
    fs.writeFile(filePath, csvData, (err) => {
        if (err) {
            console.error('Error saving CSV file:', err);
            return res.status(500).send('Failed to save data');
        }
     // console.log('CSV file saved successfully');
        res.status(200).send('Data saved');
    });
});

app.get('/get-csv-data', (req, res) => {
    const directoryPath = path.join(__dirname, 'path');

    readCSVFiles(directoryPath, (data) => {
        if (data.length === 0) {
            // Handle case where no data is found
            return res.status(404).json({ error: 'No CSV files found or unable to read files' });
        }

        res.json(data);  // Send the parsed data back to the client as JSON
    });
});

/*
   #####
  ##   ##
  ##   ##
   ######
       ##
      ##
   #####
Comment with a point
*/

// GET /api/comments
app.get('/api/comments', async (req, res) => {
    const { postId, limit = 15 } = req.query;
    
    try {
        const stmt = db.prepare(`
            SELECT * FROM comments 
            WHERE postId = ? 
            ORDER BY createdAt DESC 
            LIMIT ?
        `);
        
        const comments = stmt.all(postId, limit);
        
        // Map through comments and add username for each
        const commentsWithUsernames = await Promise.all(comments.map(async (comment) => {
            try {
                const username = await getAuthorName(comment.userId);
                // console.log("comment.userId: " + comment.userId)
                // console.log("username: " + username)
                return {
                    ...comment,
                    username,
                    positionArray: comment.positionArray ? JSON.parse(comment.positionArray) : []
                };
            } catch (error) {
                // If username not found, use 'Anonymous'
                console.log("Error fetching username:", error);
                // console.log("comment.userId: " + comment.userId)
                // console.log("username: Anonymous")
                return {
                    ...comment,
                    username: 'Anonymous',
                    positionArray: comment.positionArray ? JSON.parse(comment.positionArray) : []
                };
            }
        }));

        res.json(commentsWithUsernames);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch comments',
            details: error.message 
        });
    }
});

// POST /api/comments
app.post('/api/comments', (req, res) => {
 // console.log('Session info:', req.session);
    
    if (!req.session.userInfo) {
     // console.log('Unauthorized: No session info');
        return res.status(401).json({ error: 'You must be logged in to comment' });
    }

    const { postId, content, positionArray } = req.body;
    const userId = req.session.userInfo.sub;

    try {
     // console.log('Inserting comment:', { postId, userId, content });
        
        const stmt = db.prepare(`
            INSERT INTO comments (postId, userId, content, positionArray)
            VALUES (?, ?, ?, ?)
        `);
        
        const result = stmt.run(postId, userId, content, positionArray);
     // console.log('Insert result:', result);
        
        res.status(201).json({ 
            message: 'Comment created successfully',
            commentId: result.lastInsertRowid 
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ 
            error: 'Failed to create comment',
            details: error.message 
        });
    }
});

// DELETE /api/comments/:id
app.delete('/api/comments/:id', (req, res) => {
    if (!req.session.userInfo) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const stmt = db.prepare(`
            DELETE FROM comments 
            WHERE id = ? AND userId = ?
        `);
        const result = stmt.run(req.params.id, req.session.userInfo.sub);
        res.sendStatus(result.changes ? 204 : 403);
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});
