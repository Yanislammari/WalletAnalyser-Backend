import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config';
import { Asset } from '..';

export const attributesAssetPrice = {
    uuid: 'uuid',
    asset_uuid : 'asset_uuid',
    asset_price : 'asset_price',
    asset_price_date : 'asset_price_date',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
};

export class AssetPrice extends Model {
    public uuid!: string;
    public asset_uuid!: string;
    public asset_price!: number;
    public asset_price_date!: Date;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

AssetPrice.init(
    {   
        uuid: {
            type: DataTypes.UUID,   
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4
        },
        asset_uuid: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
              model: Asset,
              key: 'uuid'
          }
        },
        asset_price: {
          type: DataTypes.FLOAT,
          allowNull: false
        },
        asset_price_date: {
          type: DataTypes.DATE,
          allowNull : false
        }
    },
    {
        sequelize,
    }
);

AssetPrice.belongsTo(Asset, { as: 'asset', foreignKey: attributesAssetPrice.asset_uuid });
