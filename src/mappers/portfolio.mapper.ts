import { Portfolio } from "../db_schema/portfolio/portfolio";
import { UserAssetBuy } from "../db_schema/portfolio/user_asset_buy";
import { UserAssetSell } from "../db_schema/portfolio/user_asset_sell";
import { UserAssetDividend } from "../db_schema/portfolio/user_asset_dividend";
import { AddPortfolioRequestDto } from "../dtos/portfolio/requests/add_portfolio.request.dto";
import { AddAssetBuyRequestDto } from "../dtos/portfolio/requests/add_asset_buy.request.dto";
import { AddAssetSellRequestDto } from "../dtos/portfolio/requests/add_asset_sell.request.dto";
import { AddAssetDividendRequestDto } from "../dtos/portfolio/requests/add_asset_dividend.request.dto";
import { PortfolioResponseDto } from "../dtos/portfolio/responses/portfolio.response.dto";
import { AssetBuyResponseDto } from "../dtos/portfolio/responses/asset_buy.response.dto";
import { AssetSellResponseDto } from "../dtos/portfolio/responses/asset_sell.response.dto";
import { AssetDividendResponseDto } from "../dtos/portfolio/responses/asset_dividend.response.dto";

export class PortfolioMapper {
  public addPortfolioDtoToEntity(dto: AddPortfolioRequestDto): Partial<Portfolio> {
    return {
      user_uuid: dto.userId,
      name: dto.name,
      display_currency_uuid: dto.displayCurrencyId ?? null,
    };
  }

  public portfolioEntityToDto(entity: Portfolio): PortfolioResponseDto {
    return {
      id: entity.uuid,
      userId: entity.user_uuid,
      name: entity.name,
      displayCurrencyId: entity.display_currency_uuid,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  public addAssetBuyDtoToEntity(dto: AddAssetBuyRequestDto): Partial<UserAssetBuy> {
    return {
      portfolio_uuid: dto.portfolioId,
      company_name: dto.companyName ?? null,
      asset_price_uuid: dto.assetPriceId ?? null,
      buy_currency_uuid: dto.buyCurrencyId,
      buy_date: dto.buyDate as unknown as Date,
      asset_buy_amount: dto.assetBuyAmount ?? null,
      asset_buy_share: dto.assetBuyShare ?? null,
      asset_buy_price_per_share: dto.assetBuyPricePerShare ?? null,
    };
  }

  public assetBuyEntityToDto(entity: UserAssetBuy): AssetBuyResponseDto {
    return {
      id: entity.uuid,
      portfolioId: entity.portfolio_uuid,
      companyName: entity.company_name,
      assetPriceId: entity.asset_price_uuid,
      buyCurrencyId: entity.buy_currency_uuid,
      buyDate: String(entity.buy_date).split("T")[0],
      assetBuyAmount: entity.asset_buy_amount,
      assetBuyShare: entity.asset_buy_share,
      assetBuyPricePerShare: entity.asset_buy_price_per_share,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  public addAssetSellDtoToEntity(dto: AddAssetSellRequestDto): Partial<UserAssetSell> {
    return {
      portfolio_uuid: dto.portfolioId,
      company_name: dto.companyName ?? null,
      asset_price_uuid: dto.assetPriceId ?? null,
      sell_currency_uuid: dto.sellCurrencyId,
      sell_date: dto.sellDate as unknown as Date,
      asset_sell_amount: dto.assetSellAmount ?? null,
      asset_sell_share: dto.assetSellShare ?? null,
      average_asset_share_buy_price: dto.averageAssetShareBuyPrice ?? null,
      asset_sell_gain: dto.assetSellGain ?? null,
    };
  }

  public assetSellEntityToDto(entity: UserAssetSell): AssetSellResponseDto {
    return {
      id: entity.uuid,
      portfolioId: entity.portfolio_uuid,
      companyName: entity.company_name,
      assetPriceId: entity.asset_price_uuid,
      sellCurrencyId: entity.sell_currency_uuid,
      sellDate: String(entity.sell_date).split("T")[0],
      assetSellAmount: entity.asset_sell_amount,
      assetSellShare: entity.asset_sell_share,
      averageAssetShareBuyPrice: entity.average_asset_share_buy_price,
      assetSellGain: entity.asset_sell_gain,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  public addAssetDividendDtoToEntity(dto: AddAssetDividendRequestDto): Partial<UserAssetDividend> {
    return {
      portfolio_uuid: dto.portfolioId,
      currency_uuid: dto.currencyId,
      cashflow_date: dto.cashflowDate as unknown as Date,
      cashflow_amount: dto.cashflowAmount,
    };
  }

  public assetDividendEntityToDto(entity: UserAssetDividend): AssetDividendResponseDto {
    return {
      id: entity.uuid,
      portfolioId: entity.portfolio_uuid,
      currencyId: entity.currency_uuid,
      cashflowDate: String(entity.cashflow_date).split("T")[0],
      cashflowAmount: entity.cashflow_amount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
