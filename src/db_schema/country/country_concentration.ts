import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config';
import { Asset } from '..';
import { Country } from './country';

export const attributesCountryConcentration = {
    uuid: 'uuid',
    country_uuid : 'country_uuid',
    asset_uuid : 'asset_uuid',
    country_concentration_percentage : 'concentration_percentage',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
};

export class CountryConcentration extends Model {
    public uuid!: string;
    public country_uuid!: string;
    public asset_uuid!: string;
    public country_concentration_percentage!: number;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

CountryConcentration.init(
    {   
        uuid: {
            type: DataTypes.UUID,   
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4
        },
        country_uuid: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
              model: Country,
              key: 'uuid'
          }
        },
        asset_uuid: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
              model: Asset,
              key: 'uuid'
          }
        },
        country_concentration_percentage: {
          type: DataTypes.FLOAT,
          allowNull: false,
          validate: {
            min: 0,
            max: 100
          }
        }
    },
    {
        sequelize,
    }
);

CountryConcentration.belongsTo(Country, { as: 'countryConcentration', foreignKey: attributesCountryConcentration.country_uuid });
CountryConcentration.belongsTo(Asset, { as: 'asset', foreignKey: attributesCountryConcentration.asset_uuid });
