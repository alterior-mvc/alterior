# @alterior/common

[![Build status on Travis CI](https://travis-ci.org/alterior-mvc/alterior.svg?branch=master)](https://travis-ci.org/alterior-mvc/alterior)
[![Join the chat at https://gitter.im/alterior-mvc/Lobby](https://badges.gitter.im/alterior-core/Lobby.svg)](https://gitter.im/alterior-mvc/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![npm version](https://badge.fury.io/js/%40alterior%2Fcore.svg)](https://www.npmjs.com/package/@alterior/core)

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