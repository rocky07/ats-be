import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = process.env.S3_BUCKET_NAME ?? 'bourntec-ats-resumes-573771905784-us-east-2-an';
const REGION = process.env.AWS_REGION ?? 'us-east-2';

const s3 = new S3Client({ region: REGION });

// Upload a resume buffer to S3. Returns the S3 key.
export async function uploadResume(candidateId, fileBuffer, mimetype, originalName) {
  const ext = originalName?.split('.').pop() ?? 'pdf';
  const key = `resumes/${candidateId}/${Date.now()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
    Metadata: { originalName: originalName ?? '' },
  }));

  return key;
}

// Generate a presigned download URL valid for 1 hour.
export async function getResumeDownloadUrl(s3Key) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

// Download a resume's raw bytes from S3 (used to re-parse an already-uploaded resume).
export async function getResumeBuffer(s3Key) {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  const chunks = [];
  for await (const chunk of Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}
