// app/src/services/nft-generator.ts
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider } from '@project-serum/anchor';
import axios from 'axios';
import { uploadToIPFS } from './ipfs-service';
import dotenv from 'dotenv';
dotenv.config();

export class NFTGeneratorService {
    private connection: Connection;
    private program: Program;

    constructor(
        connection: Connection,
        program: Program,
    ) {
        this.connection = connection;
        this.program = program;
    }

    async monitorEvents() {
        console.log('Starting event monitoring...');
        
        // Subscribe to program account changes
        this.connection.onProgramAccountChange(
            this.program.programId,
            async (accountInfo) => {
                try {
                    const decodedAccount = this.program.coder.accounts.decode(
                        'state',
                        accountInfo.accountInfo.data
                    );

                    if (decodedAccount.pendingNfts.length <= decodedAccount.minBufferThreshold) {
                        await this.generateNewNFTs(
                            decodedAccount.bufferSize - decodedAccount.pendingNfts.length
                        );
                    }
                } catch (error) {
                    console.error('Error processing account change:', error);
                }
            }
        );
    }

    async generateNewNFTs(count: number) {
        console.log(`Generating ${count} new NFTs...`);

        // Fetch latest news headlines
        const news = await this.fetchLatestNews();

        for (const headline of news.slice(0, count)) {
            try {
                // Generate image
                const image = await this.generateImage(headline);

                // Upload image to IPFS
                const imageUri = await uploadToIPFS(image);

                // Create metadata
                const metadata = {
                    name: `News NFT: ${headline.slice(0, 30)}...`,
                    description: headline,
                    image: imageUri,
                    attributes: [
                        {
                            trait_type: 'Category',
                            value: 'News'
                        },
                        {
                            trait_type: 'Date',
                            value: new Date().toISOString().split('T')[0]
                        }
                    ]
                };

                // Upload metadata to IPFS
                const metadataUri = await uploadToIPFS(JSON.stringify(metadata));

                // Add to buffer
                await this.program.methods
                    .addToBuffer(metadataUri, metadata.name, 'NEWS', 500)
                    .accounts({
                        state: this.program.state.address,
                        authority: this.program.provider.wallet.publicKey,
                    })
                    .rpc();

            } catch (error) {
                console.error('Error generating NFT:', error);
            }
        }
    }

    private async fetchLatestNews() {
        const NEWS_API_URL = process.env.NEWS_API_URL;
        const NEWS_API_KEY = process.env.NEWS_API_KEY;

        if (!NEWS_API_URL || !NEWS_API_KEY) {
            throw new Error('Missing NEWS_API configuration in environment variables');
        }

        const response = await axios.get(NEWS_API_URL, {
            headers: {
                'Authorization': `Bearer ${NEWS_API_KEY}`
            }
        });
        return response.data.headlines;
    }

    private async generateImage(prompt: string): Promise<Buffer> {
        const IMAGE_SERVICE_URL = process.env.IMAGE_SERVICE_URL;
        const IMAGE_SERVICE_API_KEY = process.env.IMAGE_SERVICE_API_KEY;

        if (!IMAGE_SERVICE_URL || !IMAGE_SERVICE_API_KEY) {
            throw new Error('Missing IMAGE_SERVICE configuration');
        }

        // We're creating a completely custom NFT art system never seen before. You thought we would just share it with everyone? 
        // Moving that portion of code to a private service for now, we might share it later.
        const response = await axios.post(
            `${IMAGE_SERVICE_URL}/generate`,
            { prompt },
            {
                headers: {
                    'Authorization': `Bearer ${IMAGE_SERVICE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        return Buffer.from(response.data);
    }
}

