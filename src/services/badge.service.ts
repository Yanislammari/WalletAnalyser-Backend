import { UserRepository } from "../repositories";
import { BadgeRepository } from "../repositories/badge/badge.repository";
import { UserBadgeRepository } from "../repositories/badge/badge_user.repository";
import { attributesUserBadge, LEVEL_ORDER, LevelBadge, UserBadge } from '../db_schema/badge/user_badge';
import { attributesBadge } from '../db_schema/badge/badge';
import { attributesUser } from "../db_schema";
import { BADGE_RULES, BadgeCreation, UserStats } from "../models/UserStats";
import { BASE_URL } from "../constants/env";

export class BadgeService {
  private readonly badgeRepository : BadgeRepository = new BadgeRepository()
  private readonly userBadgeRepository : UserBadgeRepository = new UserBadgeRepository()
  private readonly userRepository : UserRepository = new UserRepository()
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
    const stats: UserStats = { 
      hasAccount: true
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

  async createAllBadges() {
    const imageUrl = `${BASE_URL}images/`;
    const badgesToAdd: BadgeCreation[] = [
      {badge_image_path : imageUrl +"account.svg", badge_label : "Create an account", badge_title : "Account creation !" , check : (s : UserStats) =>{
        if(s.hasAccount) return LevelBadge.BEGINNER
        return null
      }}
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
