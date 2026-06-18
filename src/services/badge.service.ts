import { CurrenciesRepository, PortfolioRepository, UserRepository } from "../repositories";
import { BadgeRepository } from "../repositories/badge/badge.repository";
import { UserBadgeRepository } from "../repositories/badge/badge_user.repository";
import { attributesUserBadge, LEVEL_ORDER, LevelBadge, UserBadge } from '../db_schema/badge/user_badge';
import { attributesBadge } from '../db_schema/badge/badge';
import { attributesCurrency, attributesPortfolio, attributesUser } from "../db_schema";
import { BADGE_RULES, BadgeCreation, UserStats } from "../models/UserStats";
import { BASE_URL } from "../constants/env";
import { PortfolioTotalService } from "./portfolio/portfolio.total.service";

export class BadgeService {
  private readonly currencyRepository = new CurrenciesRepository()
  private readonly badgeRepository : BadgeRepository = new BadgeRepository()
  private readonly userBadgeRepository : UserBadgeRepository = new UserBadgeRepository()
  private readonly userRepository : UserRepository = new UserRepository()
  private readonly portfolioRepository = new PortfolioRepository()
  private readonly portfolioTotalService = new PortfolioTotalService()
  constructor() {}

  async getAllBadges(user_id : string) { // return length ( number of total badge ), new, badges, new_badges
    const user = await this.userRepository.getById(user_id)
    if(!user) {
      throw Error("NO_USER")
    }
    const timeLeft = user.gift_date ? user.gift_date.getTime() - Date.now() : -1
    let newBadges: UserBadge[] = [];
    let nextGiftDate: number | null = null;

    if (timeLeft < 0) {
      ({ newBadges, nextGiftDate } = await this.getNewBadges(user_id));
    }
    const badges = await this.userBadgeRepository.getAllBadgesForUser(user_id)
    const allBadges = await this.badgeRepository.get(
      {},
      [attributesBadge.uuid]
    )
    const allBadgesUuid = allBadges.map((b: { uuid: string }) => b.uuid);
    return { allBadges : allBadgesUuid, userBadge : badges, newBadges, nextGiftDate, isNew : timeLeft < 0 }
  }

  async getNewBadges(user_id : string) : Promise<{ newBadges: UserBadge[], nextGiftDate: number }> {
    const date = new Date(Date.now() + 1 * 60 * 1000)
    await this.userRepository.update(user_id,{
      [attributesUser.giftDate] : date
    })
    const newBadges : UserBadge[] = []
    const userBadges = await this.userBadgeRepository.getAllBadgesForUser(user_id)
    const userPortfolios = await this.portfolioRepository.get({
      where : {[attributesPortfolio.user_uuid] : user_id }
    });
    let max = 0;
    let amountOfDividend = 0;
    let numberOfAssetBuy = 10;
    let numberOfAssetsSell = 5;
    let numberOfEtfBuy = 3;
    let numberOfEtfSell = 1;
  
    for(const portfolio of userPortfolios) {
      const currencyId = await this.currencyRepository.get({
        where : {[attributesCurrency.currency_name] : "USD"}
      })
      if(currencyId.length == 0) throw new Error("NO_CURRENCY")
      const size = await this.portfolioTotalService.getPortfolioTotal(portfolio.uuid, currencyId[0].uuid)
      if(size.portfolioMarketValue > max) {
        max = size.portfolioMarketValue
      }
      if(size.totalDividends > amountOfDividend){
        amountOfDividend = size.totalDividends
      }
      // mock
      // faire la logique pour le nombre d'asset buy, sell, etf buy, etf sell
    }
    const stats: UserStats = { 
      hasAccount: true,
      portfolioValue : max,
      amountOfDividend : amountOfDividend,
      numberOfAssetBuy : numberOfAssetBuy,
      numberOfAssetSell : numberOfAssetsSell,
      numberOfETFBuy : numberOfEtfBuy,
      numberOfETFSell : numberOfEtfSell
    };

    for (const rule of BADGE_RULES) {
      const newLevel = rule.check(stats);
      if (newLevel === null) continue;

      const existing = userBadges.find((b: UserBadge) => b.badge_uuid === rule.badge_uuid);

      if (!existing) {
        const userBadge = await this.userBadgeRepository.addBage(user_id, rule.badge_uuid, newLevel);
        const newBadge = await this.userBadgeRepository.getBadgesDetailById(userBadge.uuid)
        newBadge ? newBadges.push(newBadge) : null
      } else if (LEVEL_ORDER[newLevel] > LEVEL_ORDER[existing.level_badge]) {
        const userBadge = await this.userBadgeRepository.update(existing.uuid, {
          [attributesUserBadge.level_badge] : newLevel
        });
        if(userBadge == null)continue
        const newBadge = await this.userBadgeRepository.getBadgesDetailById(userBadge.uuid)
        newBadge ? newBadges.push(newBadge) : null
      }
    }

    return { newBadges , nextGiftDate : date.getTime() }
  }

  private getLevelBadgeActionOnAsset(value: number) {
    if (value >= 10) {
      return LevelBadge.EXPERT
    } else if (value >= 5) {
      return LevelBadge.ADVANCED
    } else if (value >= 3) {
      return LevelBadge.INTERMEDIATE
    } else if (value >= 1) {
      return LevelBadge.BEGINNER
    }

    return null
  }

  async createAllBadges() {
    const imageUrl = `${BASE_URL}images/`;
    const badgesToAdd: BadgeCreation[] = [
      {badge_image_path : imageUrl +"account.svg", badge_title : "Account creation !", badge_label : "Create an account.", check : (s : UserStats) =>{
        if(s.hasAccount) return LevelBadge.BEGINNER
        return null
      }},
      {
        badge_image_path : imageUrl + "buy_assets.svg", badge_title : "Action buyer", badge_label : "Risk lover ? Buy more to find if you like that.", check : (s : UserStats) => {
          return this.getLevelBadgeActionOnAsset(s.numberOfAssetBuy)
        }
      },
      {
        badge_image_path : imageUrl + "sell_assets.svg", badge_title : "Action seller", badge_label : "Profit taker ? Sell more and don't forget the taxes.", check : (s : UserStats) => {
          return this.getLevelBadgeActionOnAsset(s.numberOfAssetSell)
        }
      },
      {
        badge_image_path : imageUrl + "buy_etf.svg", badge_title : "ETF buyer", badge_label : "Are you preparing for retirement ? Buy more etf to enjoy it.", check : (s : UserStats) => {
          return this.getLevelBadgeActionOnAsset(s.numberOfETFBuy)
        }
      },
      {
        badge_image_path : imageUrl + "sell_etf.svg", badge_title : "ETF seller", badge_label : "Is retirement near ? Sell more ETF to enjoy it.", check : (s : UserStats) => {
          return this.getLevelBadgeActionOnAsset(s.numberOfETFSell)
        }
      },
      {
        badge_image_path : imageUrl + "size.svg", badge_title : "Becoming Warren Buffet", badge_label : "Do you think you can meet Warren Buffet ? Increase the size of your portfolios to find out.", check : (s : UserStats) => {
          if(s.portfolioValue > 2000) {
            return LevelBadge.EXPERT
          } else if (s.portfolioValue > 1000) {
            return LevelBadge.ADVANCED
          } else if (s.portfolioValue > 500) {
            return LevelBadge.INTERMEDIATE
          } else if (s.portfolioValue > 100) {
            return LevelBadge.BEGINNER
          }
          return null
        }
      },
      {
        badge_image_path : imageUrl + "dividend.svg", badge_title : "Blue chips investor", badge_label : "Does TTE sounds fun to you ? Welp I guess keep going", check : (s : UserStats) => {
          if(s.amountOfDividend > 200) {
            return LevelBadge.EXPERT
          } else if (s.amountOfDividend > 100) {
            return LevelBadge.ADVANCED
          } else if (s.amountOfDividend > 50) {
            return LevelBadge.INTERMEDIATE
          } else if (s.amountOfDividend > 10) {
            return LevelBadge.BEGINNER
          }
          return null
        }
      },
    ]
    for(const badge of badgesToAdd) {
      const alreadyExisting = await this.badgeRepository.get({where : {[attributesBadge.badge_title] : badge.badge_title}})
      if(alreadyExisting.length != 0) {
        BADGE_RULES.push({ badge_uuid : alreadyExisting[0].uuid , check : badge.check})
        continue
      }
      console.log("Creating badge :", badge.badge_title)
      const badgeCreated = await this.badgeRepository.createBadgeAdmin(badge)
      BADGE_RULES.push({ badge_uuid : badgeCreated.uuid , check : badge.check})
    }
  }
}
