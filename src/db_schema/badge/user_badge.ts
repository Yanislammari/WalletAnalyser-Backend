import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { User } from "../users/users";
import { Badge } from "./badge";

export enum LevelBadge {
  BEGINNER = "BEGINNER",
  INTERMEDIATE = "INTERMEDIATE",
  ADVANCED = "ADVANCED",
  EXPERT = "EXPERT",
}

export const LEVEL_ORDER: Record<LevelBadge, number> = {
  [LevelBadge.BEGINNER]:     1,
  [LevelBadge.INTERMEDIATE]: 2,
  [LevelBadge.ADVANCED]:     3,
  [LevelBadge.EXPERT]:       4,
};

export const attributesUserBadge = {
  uuid: "uuid",
  user_uuid: "user_uuid",
  badge_uuid: "badge_uuid",
  level_badge: "level_badge",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class UserBadge extends Model {
  public uuid!: string;
  public user_uuid!: string;
  public badge_uuid!: string;
  public level_badge!: LevelBadge;
  public badge!: Badge;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserBadge.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    badge_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Badge,
        key: "uuid",
      },
    },
    level_badge: {
      type: DataTypes.ENUM(...Object.values(LevelBadge)),
      allowNull: false,
      defaultValue: LevelBadge.BEGINNER,
    },
  },
  {
    sequelize,
  }
);

UserBadge.belongsTo(User, { 
  as: "user", 
  foreignKey: attributesUserBadge.user_uuid,
  onDelete: "CASCADE"
});

UserBadge.belongsTo(Badge, { 
  as: "badge", 
  foreignKey: attributesUserBadge.badge_uuid,
  onDelete: "CASCADE"
});

User.hasMany(UserBadge, {
  as: "userBadges",
  foreignKey: attributesUserBadge.user_uuid
})

Badge.hasMany(UserBadge, {
  as: "userBadges",
  foreignKey: attributesUserBadge.badge_uuid
});