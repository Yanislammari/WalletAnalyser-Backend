import { attributesUserBadge, Badge, LevelBadge, UserBadge } from "../../db_schema";
import { BaseRepository } from "../base.repository";
import { BadgeRepository } from "./badge.repository";

export class UserBadgeRepository extends BaseRepository<UserBadge> {
  constructor() {
    super(UserBadge);
  }

  async getAllBadgesForUser(user_id : string): Promise<UserBadge[]> {
    const userBadges = await UserBadge.findAll({
      where : {[attributesUserBadge.user_uuid] : user_id },
      order: [
        [attributesUserBadge.badge_uuid, "DESC"],
      ],
      include: [{
        model: Badge,
        as: "badge",
      }],
    })
    return userBadges
  }

  async getBadgesDetailById(uuid : string): Promise<UserBadge | null> {
    const userBadges = await UserBadge.findOne({
      where : {[attributesUserBadge.uuid] : uuid },
      include: [{
        model: Badge,
        as: "badge",
      }],
    })
    return userBadges
  }

  async addBage(user_id : string, badge_uuid : string, level : LevelBadge) {
    return await UserBadge.create({
      [attributesUserBadge.user_uuid] : user_id,
      [attributesUserBadge.badge_uuid] : badge_uuid,
      [attributesUserBadge.level_badge] : level
    })
  }
}
