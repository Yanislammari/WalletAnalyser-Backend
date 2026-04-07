import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config';
import { Sector } from './sector';

export const attributesSectorAllias = {
    uuid: 'uuid',
    sector_uuid : 'sector_uuid',
    sector_allias_name : 'sector_allias_name',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
};

export class SectorAllias extends Model {
    public uuid!: string;
    public sector_uuid!: string;
    public sector_allias_name!: string;
    public sector! : Sector;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

SectorAllias.init(
    {   
        uuid: {
            type: DataTypes.UUID,   
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4
        },
        sector_uuid: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
              model: Sector,
              key: 'uuid'
          }
        },
        sector_allias_name: {
          type: DataTypes.STRING,
          allowNull: false
        }
    },
    {
        sequelize,
    }
);

SectorAllias.belongsTo(Sector, { as: 'sector', foreignKey: attributesSectorAllias.sector_uuid });
Sector.hasMany(SectorAllias, {as : 'sectorAllias',foreignKey : attributesSectorAllias.sector_uuid})
