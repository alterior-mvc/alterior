import { bootstrap, Get, OpenApiController, Mount, Controller, AppOptions } from '../../dist';

@Controller('', {
    group: 'test'
})
export class FunController {
    @Get()
    fun() {
        return { message: 'funfunfun' };
    }
    @Get('/things')
    things() {
        return { message: 'things' };
    }
}

@Controller('')
export class SpecialFunController {
    @Get()
    especiallyFun() {
        return { message: 'funfunfun' };
    }
    @Get('/things')
    especiallyThings() {
        return { message: 'things' };
    }
}

@AppOptions({
    name: 'hello-world',
    description: 'a simple api',
    autoRegisterControllers: false
})
export class Application {

    @Mount('/openapi')
    openapi : OpenApiController;

    @Mount('/fun')
    fun : FunController;

    @Mount('/special')
    special : SpecialFunController;

    @Get()
    async home() {
        return { app: 'hello-world' };
    }

    @Get('foo/:id')
    async foo() {
        return { app: 'hello-world' };
    }

    @Get('bar/:id')
    async bar(id : string) {
        return { app: 'hello-world' };
    }
}
