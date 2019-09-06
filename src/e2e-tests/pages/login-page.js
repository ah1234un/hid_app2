/* jshint module: true */
var LoginPage = function() {
  this.emailInput = element(by.id('email'));
  this.passwordInput = element(by.id('password'));
  this.loginButton = element(by.css('.t-login-btn'));
  this.errorModal = element(by.css('.modal-dialog'));
  this.errorModalText = element(by.css('.modal-body'));

  this.get = function () {
    browser.get(browser.baseUrl);
  };

  this.login = function () {
    this.emailInput.sendKeys(browser.params.email);
    this.passwordInput.sendKeys(browser.params.password);
    this.loginButton.click();
  };

  this.loginAdmin = function () {
    this.emailInput.sendKeys(browser.params.adminEmail);
    this.passwordInput.sendKeys(browser.params.adminPassword);
    this.loginButton.click();
  };

  this.loginInvalid = function () {
    this.emailInput.sendKeys('testuser@example.com');
    this.passwordInput.sendKeys('notthepassword');
    this.loginButton.click();
  };
};

module.exports = LoginPage;
