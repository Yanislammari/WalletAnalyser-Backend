import { Request, Response } from "express";
import { PortfolioService } from "../services/portfolio/portfolio.service";
import { AddPortfolioRequestDto } from "../dtos/portfolio/requests/add_portfolio.request.dto";
import { AddAssetBuyRequestDto } from "../dtos/portfolio/requests/add_asset_buy.request.dto";
import { AddAssetSellRequestDto } from "../dtos/portfolio/requests/add_asset_sell.request.dto";
import { AddAssetDividendRequestDto } from "../dtos/portfolio/requests/add_asset_dividend.request.dto";
import { AssetBuyResponseDto, AssetDividendResponseDto, AssetSellResponseDto, PortfolioResponseDto } from "../dtos";

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
      const userId: string | string[] = req.params.userId;
      const response: PortfolioResponseDto[] = await this.portfolioService.getPortfoliosByUserId(userId as string);
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
      const portfolioId: string | string[] = req.params.portfolioId;
      const response: AssetBuyResponseDto[] = await this.portfolioService.getBuysByPortfolioId(portfolioId as string);
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
      const portfolioId: string | string[] = req.params.portfolioId;
      const response: AssetSellResponseDto[] = await this.portfolioService.getSellsByPortfolioId(portfolioId as string);
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
      const portfolioId: string | string[] = req.params.portfolioId;
      const response: AddAssetDividendRequestDto[] = await this.portfolioService.getDividendsByPortfolioId(portfolioId as string);
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
}

export default PortfolioController;
