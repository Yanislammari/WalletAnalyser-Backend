import { Request, Response } from "express";
import { PortfolioService } from "../services/portfolio/portfolio.service";
import { AddPortfolioRequestDto } from "../dtos/portfolio/requests/add.portfolio.request.dto";
import { AddAssetBuyRequestDto } from "../dtos/portfolio/requests/add.asset.buy.request.dto";
import { AddAssetSellRequestDto } from "../dtos/portfolio/requests/add.asset.sell.request.dto";
import { AddAssetDividendRequestDto } from "../dtos/portfolio/requests/add.asset.dividend.request.dto";
import { AssetBuyResponseDto, AssetDividendResponseDto, AssetSellResponseDto, PortfolioResponseDto } from "../dtos";
import { PaginatedResponseDto } from "../dtos/common/paginated.response.dto";
import AssetCountResponse from "../dtos/portfolio/responses/asset.count.response";

class PortfolioController {
  private readonly portfolioService: PortfolioService;

  constructor() {
    this.portfolioService = new PortfolioService();
  }

  public async createPortfolio(req: Request, res: Response): Promise<Response> {
    try {
      const request: AddPortfolioRequestDto = req.body;
      const response: PortfolioResponseDto = await this.portfolioService.createPortfolio(request);
      return res.status(201).json(response);
    }
    catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getPortfoliosByUserId(req: Request, res: Response): Promise<Response> {
    try {
      const userId: string = req.params.userId as string;
      const page: number = parseInt(req.query.page as string) || 1;
      const limit: number = parseInt(req.query.limit as string) || 9;
      const search: string | undefined = (req.query.search as string) || undefined;
      const response: PaginatedResponseDto<PortfolioResponseDto> = await this.portfolioService.getPortfoliosByUserId(userId, page, limit, search);
      return res.status(200).json(response);
    }
    catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getPortfolioById(req: Request, res: Response): Promise<Response> {
    try {
      const portfolioId: string | string[] = req.params.portfolioId;
      const response: PortfolioResponseDto = await this.portfolioService.getPortfolioById(portfolioId as string);
      return res.status(200).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "PORTFOLIO_NOT_FOUND") {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getBuysByPortfolioId(req: Request, res: Response): Promise<Response> {
    try {
      const portfolioId: string = req.params.portfolioId as string;
      const page: number = parseInt(req.query.page as string) || 1;
      const limit: number = parseInt(req.query.limit as string) || 10;
      const from: string | undefined = req.query.from as string | undefined;
      const to: string | undefined = req.query.to as string | undefined;
      const company: string | undefined = req.query.company as string | undefined;
      const response: PaginatedResponseDto<AssetBuyResponseDto> = await this.portfolioService.getBuysByPortfolioId(portfolioId, page, limit, from, to, company);
      return res.status(200).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "PORTFOLIO_NOT_FOUND") {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async addAssetBuy(req: Request, res: Response): Promise<Response> {
    try {
      const request: AddAssetBuyRequestDto = req.body;
      const response: AssetBuyResponseDto = await this.portfolioService.addAssetBuy(request);
      return res.status(201).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "PORTFOLIO_NOT_FOUND") {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.status(500).json({ message: "Internal server error", detail: error instanceof Error ? error.message : String(error) });
    }
  }

  public async getSellsByPortfolioId(req: Request, res: Response): Promise<Response> {
    try {
      const portfolioId: string = req.params.portfolioId as string;
      const page: number = parseInt(req.query.page as string) || 1;
      const limit: number = parseInt(req.query.limit as string) || 10;
      const from: string | undefined = req.query.from as string | undefined;
      const to: string | undefined = req.query.to as string | undefined;
      const company: string | undefined = req.query.company as string | undefined;
      const response: PaginatedResponseDto<AssetSellResponseDto> = await this.portfolioService.getSellsByPortfolioId(portfolioId, page, limit, from, to, company);
      return res.status(200).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "PORTFOLIO_NOT_FOUND") {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async addAssetSell(req: Request, res: Response): Promise<Response> {
    try {
      const request: AddAssetSellRequestDto = req.body;
      const response: AssetSellResponseDto = await this.portfolioService.addAssetSell(request);
      return res.status(201).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "PORTFOLIO_NOT_FOUND") {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getDividendsByPortfolioId(req: Request, res: Response): Promise<Response> {
    try {
      const portfolioId :string = req.params.portfolioId as string;
      const page: number = parseInt(req.query.page as string) || 1;
      const limit: number = parseInt(req.query.limit as string) || 10;
      const from: string | undefined = req.query.from as string | undefined;
      const to: string | undefined = req.query.to as string | undefined;
      const response: PaginatedResponseDto<AssetDividendResponseDto> = await this.portfolioService.getDividendsByPortfolioId(portfolioId, page, limit, from, to);
      return res.status(200).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "PORTFOLIO_NOT_FOUND") {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async addAssetDividend(req: Request, res: Response): Promise<Response> {
    try {
      const request: AddAssetDividendRequestDto = req.body;
      const response: AssetDividendResponseDto = await this.portfolioService.addAssetDividend(request);
      return res.status(201).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "PORTFOLIO_NOT_FOUND") {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getCompaniesByPortfolioId(req: Request, res: Response): Promise<Response> {
    try {
      const portfolioId: string = req.params.portfolioId as string;
      const response: string[] = await this.portfolioService.getCompaniesByPortfolioId(portfolioId);
      return res.status(200).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "PORTFOLIO_NOT_FOUND") {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async getAssetCountByPortfolioId(req: Request, res: Response): Promise<Response> {
    try {
      const portfolioId: string = req.params.portfolioId as string;
      const response: AssetCountResponse = await this.portfolioService.getAssetCountByPortfolioId(portfolioId);
      return res.status(200).json(response);
    }
    catch (error) {
      if (error instanceof Error && error.message === "PORTFOLIO_NOT_FOUND") {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deletePortfolio(req: Request, res: Response): Promise<Response> {
    try {
      const portfolioId: string = req.params.portfolioId as string;
      await this.portfolioService.deletePortfolio(portfolioId);
      return res.status(204).send();
    }
    catch (error) {
      if (error instanceof Error && error.message === "PORTFOLIO_NOT_FOUND") {
        return res.status(404).json({ message: "Portfolio not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteAssetBuy(req: Request, res: Response): Promise<Response> {
    try {
      const buyId: string = req.params.buyId as string;
      await this.portfolioService.deleteAssetBuy(buyId);
      return res.status(204).send();
    }
    catch (error) {
      if (error instanceof Error && error.message === "BUY_NOT_FOUND") {
        return res.status(404).json({ message: "Asset buy not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteAssetSell(req: Request, res: Response): Promise<Response> {
    try {
      const sellId: string = req.params.sellId as string;
      await this.portfolioService.deleteAssetSell(sellId);
      return res.status(204).send();
    }
    catch (error) {
      if (error instanceof Error && error.message === "SELL_NOT_FOUND") {
        return res.status(404).json({ message: "Asset sell not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  public async deleteAssetDividend(req: Request, res: Response): Promise<Response> {
    try {
      const dividendId: string = req.params.dividendId as string;
      await this.portfolioService.deleteAssetDividend(dividendId);
      return res.status(204).send();
    }
    catch (error) {
      if (error instanceof Error && error.message === "DIVIDEND_NOT_FOUND") {
        return res.status(404).json({ message: "Asset dividend not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default PortfolioController;
