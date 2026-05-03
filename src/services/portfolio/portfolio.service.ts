import { PortfolioMapper } from "../../mappers/portfolio.mapper";
import { PortfolioRepository } from "../../repositories/portfolio/portfolio.repository";
import { UserAssetBuyRepository } from "../../repositories/portfolio/user_asset_buy.repository";
import { UserAssetSellRepository } from "../../repositories/portfolio/user_asset_sell.repository";
import { UserAssetDividendRepository } from "../../repositories/portfolio/user_asset_dividend.repository";
import { AddPortfolioRequestDto } from "../../dtos/portfolio/requests/add_portfolio.request.dto";
import { AddAssetBuyRequestDto } from "../../dtos/portfolio/requests/add_asset_buy.request.dto";
import { AddAssetSellRequestDto } from "../../dtos/portfolio/requests/add_asset_sell.request.dto";
import { AddAssetDividendRequestDto } from "../../dtos/portfolio/requests/add_asset_dividend.request.dto";
import { PortfolioResponseDto } from "../../dtos/portfolio/responses/portfolio.response.dto";
import { AssetBuyResponseDto } from "../../dtos/portfolio/responses/asset_buy.response.dto";
import { AssetSellResponseDto } from "../../dtos/portfolio/responses/asset_sell.response.dto";
import { AssetDividendResponseDto } from "../../dtos/portfolio/responses/asset_dividend.response.dto";
import { Portfolio, UserAssetBuy, UserAssetDividend, UserAssetSell } from "../../db_schema";

export class PortfolioService {
  private readonly portfolioRepository: PortfolioRepository;
  private readonly userAssetBuyRepository: UserAssetBuyRepository;
  private readonly userAssetSellRepository: UserAssetSellRepository;
  private readonly userAssetDividendRepository: UserAssetDividendRepository;
  private readonly portfolioMapper: PortfolioMapper;

  constructor() {
    this.portfolioRepository = new PortfolioRepository();
    this.userAssetBuyRepository = new UserAssetBuyRepository();
    this.userAssetSellRepository = new UserAssetSellRepository();
    this.userAssetDividendRepository = new UserAssetDividendRepository();
    this.portfolioMapper = new PortfolioMapper();
  }

  public async createPortfolio(dto: AddPortfolioRequestDto): Promise<PortfolioResponseDto> {
    const portfolio: Portfolio = await this.portfolioRepository.add(this.portfolioMapper.addPortfolioDtoToEntity(dto));
    return this.portfolioMapper.portfolioEntityToDto(portfolio);
  }

  public async getPortfoliosByUserId(userId: string): Promise<PortfolioResponseDto[]> {
    const portfolios: Portfolio[] = await this.portfolioRepository.get({ where: { user_uuid: userId } });
    return portfolios.map((portfolio) => this.portfolioMapper.portfolioEntityToDto(portfolio));
  }

  public async getPortfolioById(portfolioId: string): Promise<PortfolioResponseDto> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }
    
    return this.portfolioMapper.portfolioEntityToDto(portfolio);
  }

  public async getBuysByPortfolioId(portfolioId: string): Promise<AssetBuyResponseDto[]> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const assetBuys: UserAssetBuy[] = await this.userAssetBuyRepository.getByPortfolioId(portfolioId);
    return assetBuys.map((assetBuy) => this.portfolioMapper.assetBuyEntityToDto(assetBuy));
  }

  public async getSellsByPortfolioId(portfolioId: string): Promise<AssetSellResponseDto[]> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }
    
    const assetSells: UserAssetSell[] = await this.userAssetSellRepository.getByPortfolioId(portfolioId);
    return assetSells.map((assetSell) => this.portfolioMapper.assetSellEntityToDto(assetSell));
  }

  public async getDividendsByPortfolioId(portfolioId: string): Promise<AssetDividendResponseDto[]> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const assetDividends: UserAssetDividend[] = await this.userAssetDividendRepository.getByPortfolioId(portfolioId);
    return assetDividends.map((assetDividend) => this.portfolioMapper.assetDividendEntityToDto(assetDividend));
  }

  public async addAssetBuy(request: AddAssetBuyRequestDto): Promise<AssetBuyResponseDto> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(request.portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }
    
    const assetBuy: UserAssetBuy = await this.userAssetBuyRepository.add(this.portfolioMapper.addAssetBuyDtoToEntity(request));
    return this.portfolioMapper.assetBuyEntityToDto(assetBuy);
  }

  public async addAssetSell(request: AddAssetSellRequestDto): Promise<AssetSellResponseDto> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(request.portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }
    
    const assetSell: UserAssetSell = await this.userAssetSellRepository.add(this.portfolioMapper.addAssetSellDtoToEntity(request));
    return this.portfolioMapper.assetSellEntityToDto(assetSell);
  }

  public async addAssetDividend(request: AddAssetDividendRequestDto): Promise<AssetDividendResponseDto> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(request.portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const assetDividend: UserAssetDividend = await this.userAssetDividendRepository.add(this.portfolioMapper.addAssetDividendDtoToEntity(request));
    return this.portfolioMapper.assetDividendEntityToDto(assetDividend);
  }

  public async getAssetCountByPortfolioId(portfolioId: string): Promise<{ buys: number; sells: number; dividends: number; total: number }> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const [buys, sells, dividends] = await Promise.all([
      this.userAssetBuyRepository.countByPortfolioId(portfolioId),
      this.userAssetSellRepository.countByPortfolioId(portfolioId),
      this.userAssetDividendRepository.countByPortfolioId(portfolioId),
    ]);

    return { buys, sells, dividends, total: buys + sells + dividends };
  }

  public async deletePortfolio(portfolioId: string): Promise<void> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    await this.portfolioRepository.remove(portfolioId);
  }

  public async deleteAssetBuy(buyId: string): Promise<void> {
    const deleted: boolean = await this.userAssetBuyRepository.remove(buyId);
    if (!deleted) {
      throw new Error("BUY_NOT_FOUND");
    }
  }

  public async deleteAssetSell(sellId: string): Promise<void> {
    const deleted: boolean = await this.userAssetSellRepository.remove(sellId);
    if (!deleted) {
      throw new Error("SELL_NOT_FOUND");
    }
  }

  public async deleteAssetDividend(dividendId: string): Promise<void> {
    const deleted: boolean = await this.userAssetDividendRepository.remove(dividendId);
    if (!deleted) {
      throw new Error("DIVIDEND_NOT_FOUND");
    }
  }
}
