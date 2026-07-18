import { AUTH_THROTTLE_KEY, AuthThrottle } from './auth-throttle.decorator';

describe('AuthThrottle decorator', () => {
  it('sets authThrottle metadata to true', () => {
    class TestController {
      @AuthThrottle()
      login() {
        return true;
      }
    }

    const actualMetadata = Reflect.getMetadata(
      AUTH_THROTTLE_KEY,
      TestController.prototype.login,
    );

    expect(actualMetadata).toBe(true);
  });
});
