import { RekognitionClient, CompareFacesCommand } from '@aws-sdk/client-rekognition';
import { TextractClient, AnalyzeIDCommand } from '@aws-sdk/client-textract';

const REGION = process.env.AWS_REGION ?? 'us-east-2';
const rekognition = new RekognitionClient({ region: REGION });
const textract = new TextractClient({ region: REGION });

const SIMILARITY_THRESHOLD = 80; // Rekognition CompareFaces % confidence

const b64ToBytes = (b64) => Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

const normalizeName = (name = '') =>
    name
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);

// Considers a match if every token of the shorter name appears in the longer name's token set.
const namesMatch = (a, b) => {
    const tokensA = normalizeName(a);
    const tokensB = normalizeName(b);
    if (!tokensA.length || !tokensB.length) return false;
    const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
    return shorter.every((t) => longer.includes(t));
};

const extractNameFromIdFields = (fields = []) => {
    const get = (key) => fields.find((f) => f.Type?.Text === key)?.ValueDetection?.Text ?? '';
    const first = get('FIRST_NAME');
    const last = get('LAST_NAME');
    if (first || last) return `${first} ${last}`.trim();
    return get('NAME') || '';
};

// Compares a live selfie against the photo on an ID document, and extracts the
// document's printed name to check against the candidate's claimed name.
export const verifyIdentity = async ({ selfieImageBase64, idImageBase64, candidateName }) => {
    if (!selfieImageBase64 || !idImageBase64) {
        throw new Error('Both a selfie and an ID document image are required');
    }

    const selfieBytes = b64ToBytes(selfieImageBase64);
    const idBytes = b64ToBytes(idImageBase64);

    const [compareResult, idResult] = await Promise.all([
        rekognition.send(new CompareFacesCommand({
            SourceImage: { Bytes: selfieBytes },
            TargetImage: { Bytes: idBytes },
            SimilarityThreshold: 0,
        })),
        textract.send(new AnalyzeIDCommand({
            DocumentPages: [{ Bytes: idBytes }],
        })),
    ]);

    const bestMatch = (compareResult.FaceMatches ?? []).sort((a, b) => b.Similarity - a.Similarity)[0];
    const similarity = bestMatch?.Similarity ?? 0;
    const faceMatch = similarity >= SIMILARITY_THRESHOLD;

    const idFields = idResult.IdentityDocuments?.[0]?.IdentityDocumentFields ?? [];
    const extractedName = extractNameFromIdFields(idFields);
    const nameMatch = extractedName ? namesMatch(extractedName, candidateName ?? '') : false;

    return {
        verified: faceMatch && nameMatch,
        faceMatch,
        similarity: Math.round(similarity * 10) / 10,
        extractedName,
        nameMatch,
    };
};
