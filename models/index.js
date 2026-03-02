const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

const User = require('./User')(sequelize);
const Team = require('./Team')(sequelize);
const Match = require('./Match')(sequelize);
const TeamMember = require('./TeamMember')(sequelize);

// Определение связей
User.hasMany(Team, { as: 'createdTeams', foreignKey: 'createdBy' });
Team.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

Team.belongsToMany(User, { through: TeamMember, foreignKey: 'teamId', otherKey: 'userId' });
User.belongsToMany(Team, { through: TeamMember, foreignKey: 'userId', otherKey: 'teamId' });

Match.belongsTo(Team, { as: 'team1', foreignKey: 'team1Id' });
Match.belongsTo(Team, { as: 'team2', foreignKey: 'team2Id' });
Match.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

module.exports = {
  sequelize,
  User,
  Team,
  Match,
  TeamMember
};