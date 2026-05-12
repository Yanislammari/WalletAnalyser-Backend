import { PortfolioMapper } from "../../mappers/portfolio.mapper";
import { PortfolioRepository } from "../../repositories/portfolio/portfolio.repository";
import { UserAssetBuyRepository } from "../../repositories/portfolio/user.asset.buy.repository";
import { UserAssetSellRepository } from "../../repositories/portfolio/user.asset.sell.repository";
import { UserAssetDividendRepository } from "../../repositories/portfolio/user.asset.dividend.repository";
import { AddPortfolioRequestDto } from "../../dtos/portfolio/requests/add.portfolio.request.dto";
import { AddAssetBuyRequestDto } from "../../dtos/portfolio/requests/add.asset.buy.request.dto";
import { AddAssetSellRequestDto } from "../../dtos/portfolio/requests/add.asset.sell.request.dto";
import { AddAssetDividendRequestDto } from "../../dtos/portfolio/requests/add.asset.dividend.request.dto";
import { PortfolioResponseDto } from "../../dtos/portfolio/responses/portfolio.response.dto";
import { AssetBuyResponseDto } from "../../dtos/portfolio/responses/asset.buy.response.dto";
import { AssetSellResponseDto } from "../../dtos/portfolio/responses/asset.sell.response.dto";
import { AssetDividendResponseDto } from "../../dtos/portfolio/responses/asset.dividend.response.dto";
import { PaginatedResponseDto } from "../../dtos/common/paginated.response.dto";
import AssetCountResponse from "../../dtos/portfolio/responses/asset.count.response";
import { Portfolio } from "../../db_schema/portfolio/portfolio";
import { UserAssetBuy } from "../../db_schema/portfolio/user_asset_buy";
import { UserAssetSell } from "../../db_schema/portfolio/user_asset_sell";
import { UserAssetDividend } from "../../db_schema/portfolio/user_asset_dividend";

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

  public async getPortfoliosByUserId(userId: string, page: number, limit: number, search?: string): Promise<PaginatedResponseDto<PortfolioResponseDto>> {
    const { rows, count } = await this.portfolioRepository.getByUserId(userId, page, limit, search);
    return { data: rows.map((portfolio) => this.portfolioMapper.portfolioEntityToDto(portfolio)), total: count, page, limit };
  }

  public async getPortfolioById(portfolioId: string): Promise<PortfolioResponseDto> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }
    
    return this.portfolioMapper.portfolioEntityToDto(portfolio);
  }

  public async getBuysByPortfolioId(portfolioId: string, page: number, limit: number, from?: string, to?: string, company?: string): Promise<PaginatedResponseDto<AssetBuyResponseDto>> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const { rows, count } = await this.userAssetBuyRepository.getByPortfolioId(portfolioId, page, limit, from, to, company);
    return { data: rows.map((row) => this.portfolioMapper.assetBuyEntityToDto(row)), total: count, page, limit };
  }

  public async getSellsByPortfolioId(portfolioId: string, page: number, limit: number, from?: string, to?: string, company?: string): Promise<PaginatedResponseDto<AssetSellResponseDto>> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const { rows, count } = await this.userAssetSellRepository.getByPortfolioId(portfolioId, page, limit, from, to, company);
    return { data: rows.map((row) => this.portfolioMapper.assetSellEntityToDto(row)), total: count, page, limit };
  }

  public async getDividendsByPortfolioId(portfolioId: string, page: number, limit: number, from?: string, to?: string): Promise<PaginatedResponseDto<AssetDividendResponseDto>> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const { rows, count } = await this.userAssetDividendRepository.getByPortfolioId(portfolioId, page, limit, from, to);
    return { data: rows.map((row) => this.portfolioMapper.assetDividendEntityToDto(row)), total: count, page, limit };
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

  public async getCompaniesByPortfolioId(portfolioId: string): Promise<string[]> {
    const portfolio: Portfolio | null = await this.portfolioRepository.getById(portfolioId);
    if (!portfolio) {
      throw new Error("PORTFOLIO_NOT_FOUND");
    }

    const [buyCompanies, sellCompanies] = await Promise.all([
      this.userAssetBuyRepository.getDistinctCompanies(portfolioId),
      this.userAssetSellRepository.getDistinctCompanies(portfolioId),
    ]);

    return [...new Set([...buyCompanies, ...sellCompanies])].sort();
  }

  public async getAssetCountByPortfolioId(portfolioId: string): Promise<AssetCountResponse> {
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
