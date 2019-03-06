# @alterior/common

[![Version](https://img.shields.io/npm/v/@alterior/common.svg)](https://www.npmjs.com/package/@alterior/common)

Provides a number of base classes, utilities, and errors which are useful in constructing larger applications.

## clone()

Use `clone()` to create a serialized clone of the given object. This is implemented as passing to JSON and back.

## Environment class 

Provides an injectable service which provides environment variables to your application. Will read from dotenv files as well.

## Errors

This package provides many fundamental error types that are intended for you to use to simplify development. The rest of 
Alterior also relies upon these.

## timeout()

Use this to get a promise for a timeout interval.