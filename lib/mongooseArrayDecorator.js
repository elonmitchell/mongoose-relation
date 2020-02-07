'use strict';
const compareVersion = require('semver-compare')

module.exports = function (mongoose) {
  const orignalMongooseArray = mongoose.Types.Array

  const MongooseArray = function (values, path, doc) {
    const arr = orignalMongooseArray(values, path, doc);
    const self = arr.__proto__;

    const getParent = function (child) {
      return compareVersion(mongoose.version, '5.6.0') < 0 ? child._parent : child.$parent();
    }

    const getSchema = function (child) {
      return compareVersion(mongoose.version, '5.6.0') < 0 ? child._schema : child.$schema();
    }

    self.build = function (object) {
      const schema = getSchema(this);
      const parent = getParent(this);

      let Model = mongoose.model(schema.caster.options.ref);
      let child = new Model(object);

      parent[schema.path].push(child._id);
      child[schema.options.siblingPathName].push(parent._id);

      return child;
    };

    self.append = function (child, callback) {
      const schema = getSchema(this);
      const parent = getParent(this);

      parent[schema.path].push(child._id);
      child[schema.options.siblingPathName].push(parent._id);

      let count = 2;

      child.save(function (err) {
        if (err) { return callback(err); }
        --count || callback(err, child)
      });

      parent.save(function (err) {
        if (err) { return callback(err); }
        --count || callback(err, child)
      });
    };

    self.create = function (objects, callback) {
      const parent = getParent(this);

      let complete = function (err, docs) {
        if (err) {
          callback(err);
        } else {
          parent.save(function (err) {
            if(err) {
              callback(err)
            } else {
              callback(null, docs);
            }
          });
        }
      }.bind(this);

      if (Array.isArray(objects)) {
        let docs = [];
        let count = objects.length;

        objects.forEach(function (object) {
          this.build(object).save(function (err, doc) {
            if (err) {
              complete(err);
            } else {
              docs.push(doc);
              --count || complete(null, docs);
            }
          });
        }.bind(this));
      } else {
        this.build(objects).save(complete);
      }
    };

    self.find = function (conditions, fields, options, callback) {
      const schema = getSchema(this);
      const parent = getParent(this);

      if ('function' == typeof conditions) {
        callback = conditions;
        conditions = {};
        fields = null;
        options = null;
      }

      conditions = conditions || {};
      conditions['_id'] = { $in: parent[schema.path] };

      let Model = mongoose.model(schema.caster.options.ref);
      let query = Model.find(conditions, fields, options);


      callback && query.exec(callback);
      return query;
    };

    // remove is an alias for #pull
    self._remove = self.remove;
    self.remove = function (conditions, callback) {
      const schema = getSchema(this);
      const parent = getParent(this);

      let Model = mongoose.model(schema.caster.options.ref);

      this.find(conditions, function (err, docs) {
        if (err) { return callback (err); }

        let ids = docs.map(function (doc) { return doc._id });
        let removeConditions = { _id: { $in: ids } };

        Model.remove(removeConditions, function (err, results) {
          if (err) { return callback (err); }

          this.pull(ids);
          parent.save(function (err) {
            if (err) { return callback (err); }

            callback(null, results, docs);
          }.bind(this));
        }.bind(this));
      }.bind(this));
    };
    return arr;
  }

  mongoose.Types.Array = MongooseArray;

  return mongoose;
};
