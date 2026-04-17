const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'dbe156a38cd7832c7ec3992ece3af403';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'f14f406ca6f38d0356fdf198655fbae0';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'b541863cd0127bc26bd222fdf7473a4e1a3d6e2b61b0578895ceb626a5e0eb2a';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'workshop';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

/**
 * Upload a file to R2
 * @param {Buffer} buffer 
 * @param {string} fileName 
 * @param {string} contentType 
 */
async function uploadToR2(buffer, fileName, contentType) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    console.log(`Successfully uploaded ${fileName} to R2`);
    return fileName;
  } catch (err) {
    console.error('Error uploading to R2:', err);
    throw err;
  }
}

/**
 * Get a file stream from R2
 * @param {string} fileName 
 */
async function getFromR2(fileName) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileName,
  });

  try {
    const response = await s3Client.send(command);
    return response;
  } catch (err) {
    console.error('Error getting from R2:', err);
    throw err;
  }
}

/**
 * Upload text/JSON to R2
 * @param {string} text 
 * @param {string} fileName 
 * @param {string} contentType 
 */
async function uploadTextToR2(text, fileName, contentType = 'application/json') {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileName,
    Body: text,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    console.log(`Successfully uploaded ${fileName} to R2`);
    return fileName;
  } catch (err) {
    console.error('Error uploading text to R2:', err);
    throw err;
  }
}

/**
 * Get text from R2
 * @param {string} fileName 
 */
async function getTextFromR2(fileName) {
  try {
    const response = await getFromR2(fileName);
    return await response.Body.transformToString();
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null; // file not found is expected if database doesn't exist yet
    }
    console.error('Error getting text from R2:', err);
    throw err;
  }
}

module.exports = {
  uploadToR2,
  getFromR2,
  uploadTextToR2,
  getTextFromR2,
};
