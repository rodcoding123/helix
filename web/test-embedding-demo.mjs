import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY not set');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function demonstrateEmbedding() {
  try {
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });

    const testText = 'I just got promoted to senior engineer and I am excited about the opportunity.';

    console.log('Generating embedding for text:');
    console.log(`"${testText}"\n`);

    const result = await model.embedContent(testText);
    const embedding = result.embedding.values;

    console.log('✓ Embedding Generated Successfully');
    console.log(`  Dimension: ${embedding.length}`);

    // Calculate magnitude
    const sumOfSquares = embedding.reduce((sum, v) => sum + v * v, 0);
    const magnitude = Math.sqrt(sumOfSquares);
    console.log(`  Magnitude: ${magnitude.toFixed(6)}`);

    // Show first 10 values
    console.log(`  First 10 values: ${embedding.slice(0, 10).map(v => v.toFixed(6)).join(', ')}`);
    console.log(`  Last 10 values: ${embedding.slice(758, 768).map(v => v.toFixed(6)).join(', ')}`);

  } catch (error) {
    console.error('Failed:', error.message);
  }
}

demonstrateEmbedding();
