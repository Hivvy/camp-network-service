import { ethers } from "ethers";
import USDCAbi from "../usdc.json";
import { decrypt, encrypt } from "../config/encrypt";

class Base {
    private provider: ethers.JsonRpcProvider;
    private contractAddress: string;
    private contract: ethers.Contract | null;

    constructor(url: string, contractAddress: string) {
        this.provider = new ethers.JsonRpcProvider(url);
        this.contractAddress = contractAddress;
        this.contract = null;
    }

    async getContract() {
        if (!this.contract) {
            this.contract = new ethers.Contract(
                this.contractAddress,
                USDCAbi,
                this.provider
            );
        }
        return this.contract;
    }

    async createWallet(): Promise<{
        address: string;
        paraphrase: string;
        blockchain: string;
    }> {
        const wallet = ethers.Wallet.createRandom();

        const encrypted = encrypt(
            JSON.stringify({
                privateKey: wallet.privateKey,
                publicKey: wallet.publicKey,
            })
        );

        return {
            address: wallet.address,
            paraphrase: encrypted,
            blockchain: "CAMP",
        };
    }

    async getAccount() {
        const accounts = await this.provider.listAccounts();
        return accounts;
    }

    async getBlockNumber() {
        const blockNumber = await this.provider.getBlockNumber();
        return blockNumber;
    }

    async estimateGasBase(
        paraphrase: string,
        recipient: string,
        amount: string
    ) {
        const decrypted = decrypt(paraphrase);

        try {
            const wallet = new ethers.Wallet(
                decrypted.privateKey,
                this.provider
            );

            const contract = new ethers.Contract(
                this.contractAddress,
                USDCAbi,
                wallet
            );

            const decimals = await contract.decimals();
            const amountInSmallestUnit = ethers.parseUnits(amount, decimals);

            const gasEstimate = await contract.transfer.estimateGas(
                recipient,
                amountInSmallestUnit
            );

            const gasPrice = (await this.provider.getFeeData()).gasPrice;

            const gasFee = gasEstimate * (gasPrice ?? 0n);

            return {
                price: ethers.formatUnits(gasFee, 18),
                symbol: "base",
            };
        } catch (error) {
            console.error("Error estimating gas:", error);
            throw error;
        }
    }

    async getProvider(paraphrase: string) {
        const decrypted = decrypt(paraphrase);

        const wallet = new ethers.Wallet(decrypted.privateKey, this.provider);

        const network = await wallet?.provider?.getNetwork();

        return network;
    }

    async getBalance(
        address: string
    ): Promise<{ name: string; balance: string; chainBalance: string }> {
        try {
            console.log("balance_check");
            const contract = await this.getContract();
            // Get the token balance
            const balanceBigInt = await contract.balanceOf(address);
            const name = await contract.name();
            const decimals = await contract.decimals();
            const balance = ethers.formatUnits(balanceBigInt, decimals);
            const chainBalanceBigInt = await this.provider.getBalance(address);
            const chainBalance = ethers.formatEther(chainBalanceBigInt); // Convert to Ether format

            return {
                name: name,
                balance,
                chainBalance: chainBalance,
            };
        } catch (error) {
            console.error("Error fetching token balance:", error);
            throw error;
        }
    }

    async sendToken(
        paraphrase: string,
        recipientAddress: string,
        amount: string
    ) {
        try {
            const decrypted = decrypt(paraphrase);

            const wallet = new ethers.Wallet(
                decrypted.privateKey,
                this.provider
            );

            if (paraphrase != process.env.CENTERAL_PARAPHRASE) {
                const estimate = await this.estimateGasBase(
                    paraphrase,
                    recipientAddress,
                    amount
                );

                console.log("Sending eth");

                await this.sendBase(wallet.address, estimate.price);

                console.log("Eth sent");
            }

            const contract = new ethers.Contract(
                this.contractAddress,
                USDCAbi,
                wallet
            );

            // Convert the amount to the smallest unit (6 decimals for USDC)
            const decimals = await contract.decimals();
            const amountInSmallestUnit = ethers.parseUnits(amount, decimals);

            // Send the tokens
            const transaction = await contract.transfer(
                recipientAddress,
                amountInSmallestUnit
            );

            await transaction.wait();

            console.log(transaction);

            return transaction;
        } catch (error: any) {
            console.error("Error sending token:", error);
            throw error;
        }
    }

    async sendBase(recipientAddress: string, amount: string, paraphrase = "") {
        const decrypted = paraphrase
            ? decrypt(paraphrase)
            : decrypt(process.env.CENTERAL_PARAPHRASE);

        try {
            const wallet = new ethers.Wallet(
                decrypted.privateKey,
                this.provider
            );
            // Convert the amount to the smallest unit (CELO has 18 decimals)
            const amountInSmallestUnit = ethers.parseEther(amount);

            // Send Celo directly from the wallet
            const transaction = await wallet.sendTransaction({
                to: recipientAddress,
                value: amountInSmallestUnit,
                gasLimit: 40000,
                gasPrice: ethers.parseUnits("20", "gwei"),
            });

            await transaction.wait();

            console.log(transaction);

            return transaction;
        } catch (error) {
            console.error("Error sending base:", error);
            throw error;
        }
    }
}

export default Base;
