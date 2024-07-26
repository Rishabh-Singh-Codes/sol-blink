import express from 'express';
import cors from 'cors';
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  TransactionInstruction,
  Transaction,
  Keypair,
  SystemProgram,
} from '@solana/web3.js';
import {
  ACTIONS_CORS_HEADERS_MIDDLEWARE,
  createPostResponse,
} from '@solana/actions';

const connection = new Connection(clusterApiUrl('devnet'));

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

// Dummy program ID and vote data
const VOTE_PROGRAM_ID = SystemProgram.programId;
const VOTE_DATA = {
  question: 'Do you like Solana?',
  options: {
    A: 'Yes',
    B: 'Heck Yeah!',
  },
};

// Express app setup
const app = express();
app.use(express.json());
app.use(cors(ACTIONS_CORS_HEADERS_MIDDLEWARE));

// Routes
app.options('/actions.json', getActionsJson);
app.get('/api/actions/vote', getVote);
app.post('/api/actions/vote', postVote);

// Route handlers
function getActionsJson(req, res) {
  const payload = {
    rules: [
      { pathPattern: '/*', apiPath: '/api/actions/*' },
      { pathPattern: '/api/actions/**', apiPath: '/api/actions/**' },
    ],
  };
  res.json(payload);
}

async function getVote(req, res) {
  try {
    const baseHref = `${BASE_URL}/api/actions/vote?option=`;

    const payload = {
      title: 'Vote - Do you like Solana?',
      icon: 'https://solana-actions.vercel.app/solana_devs.jpg',
      description: 'Vote for your favorite option',
      links: {
        actions: [
          { label: 'Vote Yes', href: `${baseHref}A` },
          { label: 'Vote Heck Yeah!', href: `${baseHref}B` },
        ],
      },
    };

    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err?.message || err });
  }
}

async function postVote(req, res) {
  try {
    const { option } = req.query;
    const { account } = req.body;

    if (!account || !['A', 'B'].includes(option)) {
      throw new Error('Invalid "account" or "option" provided');
    }

    const fromPubkey = new PublicKey(account);
    const instruction = new TransactionInstruction({
      keys: [{ pubkey: fromPubkey, isSigner: true, isWritable: false }],
      programId: VOTE_PROGRAM_ID,
      data: Buffer.from(option), // Option A or B
    });

    // Attempt to fetch the latest blockhash with retry logic
    let blockhash;
    let lastValidBlockHeight;
    try {
      ({ blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash());
    } catch (error) {
      console.error('Failed to fetch latest blockhash:', error);
      throw new Error('Failed to fetch latest blockhash. Please try again later.');
    }

    const transaction = new Transaction({
      feePayer: fromPubkey,
      blockhash,
      lastValidBlockHeight,
    }).add(instruction);

    const payload = await createPostResponse({
      fields: {
        transaction,
        message: `We knew! You voted for option ${VOTE_DATA.options[option]}`,
      },
    });

    res.json(payload);
  } catch (err) {
    console.error('Error in postVote:', err);
    res.status(400).json({ error: err.message || 'An unknown error occurred' });
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
