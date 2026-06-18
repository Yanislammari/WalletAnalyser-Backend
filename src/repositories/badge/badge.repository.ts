import { attributesBadge, Badge } from "../../db_schema";
import { BadgeCreation } from "../../models/UserStats";
import { BaseRepository } from "../base.repository";

export class BadgeRepository extends BaseRepository<Badge> {
  constructor() {
    super(Badge);
  }

  async createBadgeAdmin(badge : BadgeCreation) {
    return await this.model.create({
      [attributesBadge.badge_image_path] : badge.badge_image_path,
      [attributesBadge.badge_title] : badge.badge_title,
      [attributesBadge.badge_label] : badge.badge_label
    })
  }
}




