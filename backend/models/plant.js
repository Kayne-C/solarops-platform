module.exports = (sequelize, DataTypes) => {
  const Plant = sequelize.define(
    "Plant",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [["GES", "ÇGES", "RES", "HES", "TES", "BES", "DGES"]],
        },
      },
      investor_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      field_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      coordinates: DataTypes.STRING(100),
      power: DataTypes.STRING(100),
      pv_module: DataTypes.STRING(100),
      inverter: DataTypes.STRING(100),
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "ACTIVE",
        validate: {
          isIn: [["ACTIVE", "INACTIVE"]],
        },
      },
      iec104_asdu_address: DataTypes.STRING(100),
      wan_ip_address: DataTypes.STRING(50),
      local_ip_address: DataTypes.STRING(50),
      osos_id: DataTypes.STRING(50),
      installation_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: "Santral kurulum tarihi",
      },
      depreciation_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0.0,
        validate: {
          min: 0,
          max: 100,
        },
        comment: "Yıllık yıpranma payı (%)",
      },
    },
    {
      tableName: "plants",
      underscored: true,
      timestamps: true,
    }
  );

  Plant.associate = (models) => {
    Plant.hasMany(models.DailyProduction, {
      foreignKey: "plant_id",
      as: "DailyProductions",
    });
  };

  return Plant;
};
