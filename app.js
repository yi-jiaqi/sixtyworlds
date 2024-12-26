const express = require('express');
const session = require('express-session');
const { Issuer, generators } = require('openid-client');
const app = express();
app.use(express.text({ type: 'text/*' }));  // Ensure that it handles any text content, including CSV
app.use(express.json());
const path = require('path');
const cors = require('cors');
app.use(cors());
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
const destination_login = 'http://sixtyworlds.com/callback'
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
    // console.log("initializeClient: https://cognito-idp.us-east-2.amazonaws.com/us-east-2_ArF7gdgij")
    const issuer = await Issuer.discover('https://cognito-idp.us-east-2.amazonaws.com/us-east-2_ArF7gdgij');
    client = new issuer.Client({
        client_id: 'igqvrbfgkacjbh81g2a7vfse4',
        client_secret: '1pcu8m1c24euu2nakqe68ofvv5aama9fmqbl6ksukt5euloeng6b',
        redirect_uris: [destination_login],
        response_types: ['code']
    });
}

initializeClient().catch(console.error);

// app.use((req, res, next) => {
//     console.log(`Request received for: ${req.url}`);
//     next();
// });

app.use(session({
    secret: 'some secret',
    resave: false,
    saveUninitialized: false
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

app.get('/callback', async (req, res) => {
    console.log('[Validation]');
    try {
        // Extract the authorization code and state from the query parameters
        const params = client.callbackParams(req);

        // Exchange the code for tokens
        const tokenSet = await client.callback(
            destination_login, // Must match the redirect URI in Cognito settings
            params,
            {
                nonce: req.session.nonce, // Validate nonce
                state: req.session.state, // Validate state
            }
        );

        // Fetch user information using the Access Token
        const userInfo = await client.userinfo(tokenSet.access_token);
        req.session.userInfo = userInfo; // Save user info in session
        // console.log(userInfo)
        const nickname = userInfo.nickname || "No nickname provided";
        const author_uid = userInfo.sub;

        req.session.isAuthenticated = true;

        try {
            let stream;
            let isUIDFound = false;
            let isNicknameCorrect = false;
            stream = fs.createReadStream(csvFilePath_Authors).pipe(csv());
            stream
                .on('data', (data) => {
                    if (data.UID == author_uid) {
                        isUIDFound = true
                        isNicknameCorrect = data.author_name == nickname
                        console.log("UID found: " + author_uid)
                        console.log("Nickname: " + nickname)
                        if (!isNicknameCorrect) console.log("[Error] Nickname was: " + data.author_name)
                    }
                })
                .on('end', async () => {
                    if (!isUIDFound) {
                        const newRow = `\n${nickname},${author_uid}`;
                        fs.appendFileSync(csvFilePath_Authors, newRow, "utf8");
                        console.log("UID NOT found, registering: " + author_uid)
                        console.log("Nickname: " + nickname)
                    }
                })
                .on('error', (error) => {
                    console.error('Error reading CSV file:', error);
                    res.status(500).json({ error: 'Error reading CSV file' });
                });
        } catch (error) {
            console.error('Error processing request:', error);
            res.status(500).json({ error: 'Error processing request' });
        }

        // Redirect to the homepage or another route
        res.redirect('/');
    } catch (err) {
        console.error('Error handling callback:', err);
        res.redirect('/error'); // Redirect to an error page or display a message
    }
});

app.get('/login', (req, res) => {
    // console.log("login")
    const nonce = generators.nonce();
    const state = generators.state();

    req.session.nonce = nonce;
    req.session.state = state;

    const authUrl = client.authorizationUrl({
        scope: 'phone openid email profile',
        state: state,
        nonce: nonce,
    });

    res.redirect(authUrl);
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
    const logoutUrl = `https://us-east-2arf7gdgij.auth.us-east-2.amazoncognito.com/login?client_id=igqvrbfgkacjbh81g2a7vfse4&response_type=code&scope=email+openid+phone+profile&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback`;
    res.redirect(logoutUrl);
});


// app.set('view engine', 'ejs');
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
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
        console.log("get previews with UID: " + word)
    } else {
        console.log("get previews by: " + sort)
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
                    console.log('End of the Worlds: No more data to load');
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
    console.log("trying to filter: " + author_UID)
    const passThrough = new PassThrough({ objectMode: true });

    fs.createReadStream(csvFilePath_Worlds)
        .pipe(csv())
        .on("data", (data) => {
            if (data.author_uid === author_UID) {
                // console.log("found one!")
                passThrough.write(data); // Write matching rows to the stream
            } else {

                console.log(data.author_uid)
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
    // const csvFilePath_Authors = path.join(__dirname, 'authors.csv');
    console.log("displayName: " + displayName)
    console.log("userId: " + userId)

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
                    console.log("CSV file updated successfully.");
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
    console.log("Trying to get author UID by serial: " + serial)
    getItembySerial(serial)
        .then(async (data) => {
            console.log("Resolved data:", data);

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
    console.log("getItembySerial: " + lineNumber)
    return new Promise((resolve, reject) => {
        let currentLine = 0; // Track the current line
        const targetLine = Number(lineNumber) + 2; // Calculate the target line
        let result = null;

        // Create a readable stream to process the CSV
        fs.createReadStream(csvFilePath_Worlds)
            .pipe(csv()) // Use csv-parser to parse the file
            .on("data", (data) => {
                currentLine++;
                console.log(data)
                if (currentLine == targetLine) {
                    result = data; // Store the matching row
                }
            })
            .on("end", () => {
                if (result) {
                    resolve(result); // Resolve with the matching row as an object
                    console.log(result)
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
    console.log("Trying to get the model by serial: " + modelSerial);

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
                        console.log("Successfully generated " + model_url);

                        const authorName = await getAuthorName(data.author_uid)
                        console.log(data)
                        data.author_name=authorName
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
                    console.log('Item not found with the provided serial');
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
    console.log('Saving CSV file to:', filePath);

    // Write the CSV data to a file
    fs.writeFile(filePath, csvData, (err) => {
        if (err) {
            console.error('Error saving CSV file:', err);
            return res.status(500).send('Failed to save data');
        }
        console.log('CSV file saved successfully');
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
