module.exports = (sequelize, DataTypes) => {
  const DailyProduction = sequelize.define(
    "DailyProduction",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      plant_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "plants",
          key: "id",
        },
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      type: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
        validate: {
          isIn: [[1, 2]], // 1: PVSyst beklenen, 2: Gerçekleşen
        },
      },
      production: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        comment: "Günlük gerçekleşen üretim miktarı (kWh)",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "daily_productions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          unique: true,
          fields: ["plant_id", "date", "type"],
        },
      ],
    }
  );

  DailyProduction.associate = (models) => {
    DailyProduction.belongsTo(models.Plant, {
      foreignKey: "plant_id",
      as: "Plant",
    });
  };

  return DailyProduction;
};
