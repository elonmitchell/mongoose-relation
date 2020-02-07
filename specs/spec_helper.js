var mongoose = require('../')(require('mongoose'));

var resetDb = function(next){
  mongoose.connection.db.dropDatabase(next);
};

var isConnected = function() {
  return mongoose.connection.readyState === 1
}

before(function(done){
  if(isConnected()){
    resetDb(done);
  } else {
    mongoose.connection.on('open', function(){
      resetDb(done);
    });
  }
});

after(function(){
  mongoose.disconnect();
})

var host = process.env.BOXEN_MONGODB_URL || process.env.MONGOOSE_TEST_URL || 'mongodb://localhost:27027/';
var uri = host + 'mongo_relations';

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
