'use strict';

var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();

var paths = {
  gulpfile: 'gulpfile.js',
  src: 'index.js',
  test: 'test/index_test.js',
  testDest: '.tmp/',
  templates: 'templates/**/*.hbs',
  testTypings: 'test/fixtures/definitions.d.ts'
};

var mochaOptions = {
  reporter: 'spec'
};

gulp.task('jshint', function() {
  return gulp.src([paths.gulpfile, paths.src, paths.test])
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter('default'))
    .pipe(plugins.jshint.reporter('fail'));
});

gulp.task('test', function() {
  return gulp.src(paths.test)
    .pipe(plugins.spawnMocha(mochaOptions));
});

gulp.task('default', ['jshint', 'test']);

gulp.task('watch', function() {
  gulp.watch([paths.src, paths.test, paths.templates, paths.testTypings], ['test']);
});
