import CampService from "@/services/camp";

type Environment = "production" | "sandbox";

interface NetworkConfig {
    rpcUrl: string;
    contractAddress: string;
}

const NETWORK_CONFIGS: Record<Environment, NetworkConfig> = {
    production: {
        rpcUrl: "https://rpc.camp.raas.gelato.cloud",
        contractAddress: "0x977fdEF62CE095Ae8750Fd3496730F24F60dea7a", // USDC on Base Mainnet
    },
    sandbox: {
        rpcUrl: "https://rpc.basecamp.t.raas.gelato.cloud",
        contractAddress: "0xDdADD1F2722c688f27877d4695e2bd995e5571dE", // USDC on Camp Sepolia
    },
};

export interface WalletRepositoryInterface {
    createWallet(environment: Environment): Promise<{
        address: string;
        paraphrase: string;
        blockchain: string;
    }>;
    getBalance(
        address: string,
        environment: Environment
    ): Promise<{ name: string; balance: string; chainBalance: string }>;
    sendToken(
        paraphrase: string,
        recipientAddress: string,
        amount: string,
        environment: Environment
    ): Promise<any>;
}

class WalletRepository implements WalletRepositoryInterface {
    private campService: Map<Environment, CampService> = new Map();

    constructor() {
        // Initialize BaseService instances for each environment
        Object.entries(NETWORK_CONFIGS).forEach(([env, config]) => {
            this.campService.set(
                env as Environment,
                new CampService(config.rpcUrl, config.contractAddress)
            );
        });
    }

    private getService(environment: Environment): CampService {
        const service = this.campService.get(environment);
        if (!service) {
            throw new Error(`Unsupported environment: ${environment}`);
        }
        return service;
    }
    async createWallet(environment: Environment): Promise<{
        address: string;
        paraphrase: string;
        blockchain: string;
    }> {
        const service = this.getService(environment);
        const wallet = await service.createWallet();
        return {
            address: wallet.address,
            paraphrase: wallet.paraphrase,
            blockchain: wallet.blockchain,
        };
    }

    async getBalance(
        address: string,
        environment: Environment
    ): Promise<{ name: string; balance: string; chainBalance: string }> {
        const service = this.getService(environment);
        const balance = await service.getBalance(address);
        return {
            name: balance.name,
            balance: balance.balance,
            chainBalance: balance.chainBalance,
        };
    }

    async sendToken(
        paraphrase: string,
        recipientAddress: string,
        amount: string,
        environment: Environment
    ): Promise<void> {
        try {
            const service = this.getService(environment);
            const transaction = await service.sendToken(
                paraphrase,
                recipientAddress,
                amount
            );
            return transaction;
        } catch (error: any) {
            throw new Error(error.message);
        }
    }
}

export default new WalletRepository();
