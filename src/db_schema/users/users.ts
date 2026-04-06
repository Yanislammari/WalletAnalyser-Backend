import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config';
import UserType from './user_type';

export const attributesUser = {
  id: "id",
  email: "email",
  password: "password",
  googleId: "google_id",
  firstName: "first_name",
  lastName: "last_name",
  ban: "ban",
  userType: "user_type",
  subscribe: "subscribe",
  createdAt: "created_at",
  updatedAt: "updated_at"
};

export class User extends Model {
  public id!: string;
  public email!: string;
  public password!: string | null;
  public googleId!: string | null;
  public first_name!: string;
  public last_name!: string;
  public ban!: boolean;
  public user_type!: UserType;
  public subscribe!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: {
        name: "unique_email_constraint",
        msg: "Email already exists in the database"
      },
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true
    },
    google_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: {
        name: "unique_google_id_constraint",
        msg: "Google account already linked"
      }
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    ban: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    user_type: {
      type: DataTypes.ENUM(...Object.values(UserType)),
      allowNull: false,
      defaultValue: UserType.USER
    },
    subscribe: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    sequelize,
  }
);
