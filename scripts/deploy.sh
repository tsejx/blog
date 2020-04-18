#!/bin/bash

cd public

git init
git add -A
git commit -m 'deploy'

git push -f https://github.com/tsejx/blog.git master:gh-pages