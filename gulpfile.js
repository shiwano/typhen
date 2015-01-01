'use strict';

var fs = require('fs');
var gulp = require('gulp');
var del = require('del');
var runSequence = require('run-sequence');
var merge = require('merge-stream');
var plugins = require('gulp-load-plugins')();
var spawn = require('child_process').spawn;
var open = require('open');

var paths = {
  gulpfile: 'gulpfile.js',
  src: 'src/**/*.ts',
  test: 'test/{src,integrations}/**/*_test.ts',
  dest: 'lib/',
  testDest: '.tmp/',
  typescriptFiles: ['{src,test}/**/*.ts', '!test/fixtures/**/*.ts'],
  defaultLibFiles: ['lib.typhen.d.ts', 'lib.core.d.ts']
};

var tsProject = plugins.typescript.createProject({
  target: 'ES5',
  module: 'commonjs',
  noImplicitAny: true,
  declarationFiles: true
});

var mochaOptions = {
  reporter: 'spec'
};

gulp.task('jshint', function() {
  return gulp.src(paths.gulpfile)
    .pipe(plugins.plumber())
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter('default'));
});

gulp.task('tslint', function() {
  return gulp.src(paths.typescriptFiles)
    .pipe(plugins.plumber())
    .pipe(plugins.tslint())
    .pipe(plugins.tslint.report('verbose'));
});

gulp.task('test', ['clean:testDest'], function(callback) {
  test(false, false, callback);
});

gulp.task('test:watch', function(callback) {
  test(true, false, callback);
});

gulp.task('test:watch:debug', function(callback) {
  test(true, true, callback);
});

gulp.task('clean:dest', function(callback) {
  del(paths.dest, callback);
});

gulp.task('clean:testDest', function(callback) {
  del(paths.testDest, callback);
});

gulp.task('compile', ['clean:dest'], function(){
  var tsStream = gulp.src(paths.src)
    .pipe(plugins.plumber({errorHandler: function() {
      process.exit(1);
    }}))
    .pipe(plugins.typescript(tsProject));

  var jsStream = tsStream.js
    .pipe(gulp.dest(paths.dest));
  var dtsStream = tsStream.dts
    .pipe(plugins.replace(/^\/\/\/\s*<reference\s+path="[\.\/]+typings\/tsd.d.ts"\s*\/>$/gm, ''))
    .pipe(gulp.dest(paths.dest));
  return merge(jsStream, dtsStream);
});

gulp.task('build', function(callback) {
  runSequence(['jshint', 'tslint', 'test'], 'compile', callback);
});

gulp.task('default', ['build']);

gulp.task('watch', function() {
  gulp.watch([paths.src, paths.test], ['test:watch']);
});

gulp.task('watch:debug', function() {
  spawn('node', ['node_modules/node-inspector/bin/inspector.js']);
  gulp.watch([paths.src, paths.test], ['test:watch:debug']);
});

function test(watching, debug, callback) {
  mochaOptions.debug = mochaOptions.debugBrk = debug;
  var isCompleted = false;

  gulp.src(paths.defaultLibFiles)
    .pipe(plugins.copy(paths.testDest))
    .on('end', function() {
      gulp.src(paths.typescriptFiles)
        .pipe(plugins.plumber({errorHandler: function() {
          if (watching) {
            this.emit('end');
          } else {
            process.exit(1);
          }
        }}))
        .pipe(plugins.changed(paths.testDest, {extension: '.js', hasChanged: hasChangedForTest}))
        .pipe(plugins.sourcemaps.init())
        .pipe(plugins.typescript(tsProject)).js
        .pipe(plugins.espower())
        .pipe(plugins.sourcemaps.write())
        .pipe(gulp.dest(paths.testDest))
        .on('end', function() {
          if (debug) { open('http://127.0.0.1:8080/debug?port=5858'); }
        })
        .pipe(plugins.spawnMocha(mochaOptions))
        .on('end', function() {
          if (!isCompleted) {
            callback();
            isCompleted = true;
          }
        });
    });
}

function hasChangedForTest(stream, callback, sourceFile, destPath) {
  if (!fs.existsSync(destPath)) {
    stream.push(sourceFile);
    return callback();
  }

  var destStat = fs.statSync(destPath);

  if (sourceFile.stat.mtime > destStat.mtime) {
    stream.push(sourceFile);
  } else if (/_test.ts$/.test(sourceFile.path)) {
    var testTargetPath = sourceFile.path
      .replace(/_test.ts$/, '.ts')
      .replace(process.cwd() + '/test', process.cwd());

    if (fs.existsSync(testTargetPath)) {
      var testTargetStat = fs.statSync(testTargetPath);

      if (testTargetStat.mtime > destStat.mtime) {
        stream.push(sourceFile);
      }
    }
  }

  callback();
}
