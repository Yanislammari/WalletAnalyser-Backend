import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config';
import { Currency } from './currency';

export const attributesForex = {
    uuid: 'uuid',
    base_currency : 'base_currency',
    quote_currency : 'quote_currency',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
};

export class Forex extends Model {
    public uuid!: string;
    public baseCurrency!: string;
    public quoteCurrency!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Forex.init(
    {   
        uuid: {
            type: DataTypes.UUID,   
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4
        },
        base_currency: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
              model: Currency,
              key: 'uuid'
            }
        },
        quote_currency: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
              model: Currency,
              key: 'uuid'
            }
        }  
    },
    {
        sequelize,
    }
);

Forex.belongsTo(Currency, { as: 'baseCurrency', foreignKey: attributesForex.base_currency });
Forex.belongsTo(Currency, { as: 'quoteCurrency', foreignKey: attributesForex.quote_currency });
