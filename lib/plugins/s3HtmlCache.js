var cacheManager = require('cache-manager');
var moment = require('moment');
var s3 = new (require('aws-sdk')).S3({params:{Bucket: process.env.S3_BUCKET_NAME}});

module.exports = {
    init: function() {
        this.cache = cacheManager.caching({
            store: s3_cache
        });
    },

    beforePhantomRequest: function(req, res, next) {
        if(req.method !== 'GET') {
            return next();
        }

        this.cache.get(req.prerender.url, function (err, result) {

            if (!err && result) {
                expires = moment(result.Expires, "ddd, D MMM YYYY HH:mm:ss ZZ");

                if (expires.isBefore(Date.now())) {
                    console.log('expiration date is in the past', 'new cache will be generated')
                    return next();
                }

                console.log('cache hit');
                return res.send(200, result.Body);

            }

            next();
        });
    },

    afterPhantomRequest: function(req, res, next) {
        if(req.prerender.statusCode !== 200) {
            return next();
        }

        this.cache.set(req.prerender.url, req.prerender.documentHTML, function(err, result) {
            if (err) console.error(err);
            next();
        });

    }
};


var s3_cache = {
    get: function(key, callback) {
        if (process.env.S3_PREFIX_KEY) {
            key = process.env.S3_PREFIX_KEY + '/' + key;
        }

        s3.getObject({
            Key: key
        }, callback);
    },
    set: function(key, value, callback) {
        if (process.env.S3_PREFIX_KEY) {
            key = process.env.S3_PREFIX_KEY + '/' + key;
        }

        var request = s3.putObject({
            Key: key,
            ContentType: 'text/html;charset=UTF-8',
            StorageClass: 'REDUCED_REDUNDANCY',
            Body: value,
            Expires: moment().add(3, 'hour').toISOString()
        }, callback);

        if (!callback) {
            request.send();
        }
    }
};
