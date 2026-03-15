import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config';

export const attributesCurrency = {
    uuid: 'uuid',
    currency_name : 'currency_name',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
};

export class Currency extends Model {
    public uuid!: string;
    public currency_name!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Currency.init(
    {   
        uuid: {
            type: DataTypes.UUID,   
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4
        },
        currency_name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: {
                name: 'unique_currenct_constraint',
                msg: "Currency already exists in the database"
            },
            validate: {
                notEmpty: { msg: "Currency cannot be empty" },
                notNull: { msg: "Currency can't be null" },
                len: {
                    args: [0, 5], // Minimum and maximum length
                    msg: "Currency can't be longer than 5 characters"
                },
            }
        }
    },
    {
        sequelize,
    }
);
