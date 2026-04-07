import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config';
import { Asset } from '..';

export const attributesAssetAllias = {
    uuid: 'uuid',
    asset_uuid : 'asset_uuid',
    asset_allias_name : 'asset_allias_name',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
};

export class AssetAllias extends Model {
    public uuid!: string;
    public asset_uuid!: string;
    public allias_asset_name!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

AssetAllias.init(
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
        asset_allias_name: {
          type: DataTypes.STRING,
          allowNull: false
        }
    },
    {
        sequelize,
    }
);

AssetAllias.belongsTo(Asset, { as: 'assetAllias', foreignKey: attributesAssetAllias.asset_uuid });
