// app/src/services/nft-generator.ts
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider } from '@project-serum/anchor';
import axios from 'axios';
import { uploadToIPFS } from './ipfs-service';

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
        // Replace with your preferred news API
        const response = await axios.get('https://api.example.com/news');
        return response.data.headlines;
    }

    private async generateImage(prompt: string): Promise<Buffer> {
	    #TODO!!!
        const response = await this.createImage({
            prompt: prompt,
            n: 1,
            size: '1024x1024',
        });

        const imageUrl = response.data.data[0].url;
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        return Buffer.from(imageResponse.data);
    }
}
