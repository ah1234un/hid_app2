var userDirectives = angular.module('userDirectives', []);

userDirectives.directive('hidUsers', ['$location', 'gettextCatalog', 'alertService', 'hrinfoService', 'userService', 'User', 'List', function($location, gettextCatalog, alertService, hrinfoService, userService, User, List) {
  return {
    restrict: 'E',
    templateUrl: 'app/user/users.html',
    scope: false,
    link: function (scope, elem, attrs) {
      scope.inlist = scope.list ? true : false;
      scope.request = $location.search();
      scope.totalItems = 0;
      scope.itemsPerPage = 10;
      scope.currentPage = 1;
      scope.request.limit = scope.itemsPerPage;
      scope.request.offset = 0;
      scope.request.sort = 'name';
      userService.setRequest(scope.request);

      // Helper function
      var queryCallback = function (users, headers) {
        scope.totalItems = headers()["x-total-count"];
      };

      userService.subscribe(scope, function () {
        scope.currentPage = 1;
        scope.pageChanged();
      });

      // Pager function
      scope.pageChanged = function () {
        scope.request.offset = (scope.currentPage - 1) * scope.itemsPerPage;
        if (scope.inlist) {
          scope.request[scope.list.type + 's.list'] = scope.list._id;
        }
        userService.setRequest(scope.request);
        userService.filter(queryCallback);
        scope.users = userService.getUsers();
      };

      if (!scope.inlist) {
        scope.pageChanged();
      }

      scope.filter = function() {
        userService.setFilters(scope.filters);
        scope.currentPage = 1;
        scope.pageChanged();
      };

      scope.operations = List.query({type: 'operation'});

      scope.bundles = [];
      scope.getBundles = function(search) {
        scope.bundles = List.query({type: 'bundle', name: search});
      };

      scope.disasters = [];
      scope.getDisasters = function(search) {
        scope.disasters = List.query({type: 'disaster', name: search});
      };

      scope.roles = [];
      hrinfoService.getRoles().then(function (d) {
        scope.roles = d;
      });

      scope.organizations = [];
      scope.getOrganizations = function(search) {
        scope.organizations = List.query({type: 'organization', name: search});
      };

      scope.countries = [];
      hrinfoService.getCountries().then(function (d) {
        scope.countries = d;
      });

      // Delete user account
      scope.deleteUser = function (user) {
        var alert = alertService.add('danger', gettextCatalog.getString('Are you sure you want to do this ? This user will not be able to access Humanitarian ID anymore.'), true, function() {
          user.$delete(function (out) {
            alert.closeConfirm();
            alertService.add('success', gettextCatalog.getString('The user was successfully deleted.'));
            scope.pageChanged();
          });
        });
      };
    }
  };
}]);


var userServices = angular.module('userServices', ['ngResource']);

userServices.factory('User', ['$resource', '$http', '$location', 'config',
  function($resource, $http, $location, config){

    var User = $resource(config.apiUrl + 'user/:userId', {userId: '@_id'},
    {
      'update': {
        method: 'PUT'
      }
    });

    // Return current user checkin
    User.prototype.currentCheckin = function (list) {
      var out = false;
      angular.forEach(this[list.type + 's'], function (val, key) {
        if (angular.equals(list._id, val.list)) {
          out = val;
        }
      });
      return out;
    };

    // Send claim email
    User.prototype.claimEmail = function (success, error) {
      var app_reset_url = $location.protocol() + '://' + $location.host() + '/reset_password';
      $http.put(config.apiUrl + 'user/' + this._id + '/orphan', {app_reset_url: app_reset_url}).then(success, error);
    };

    // Send password reset email
    User.passwordReset = function(email, success, error) {
      var app_reset_url = $location.protocol() + '://' + $location.host() + '/reset_password';
      $http.put(config.apiUrl + 'user/password', {email: email, app_reset_url: app_reset_url}).then(success, error);
    };

    // Reset user email
    User.resetPassword = function(hash, password, success, error) {
      $http.put(config.apiUrl + 'user/password', {hash: hash, password: password}).then(success, error);
    };

    // Verify user email
    User.verifyEmail = function (hash, success, error) {
      $http.put(config.apiUrl + 'user/email_verified', { hash: hash }).then(success, error);
    };


    return User;
    
  }
]);

userServices.factory('UserCheckIn', ['$resource', 'config',
  function ($resource, config) {
    return $resource(config.apiUrl + 'user/:userId/:listType/:checkInId');
  }
]);

userServices.factory('userService', ['$rootScope', 'User',
  function ($rootScope, User) {
    var filters = {}, userService = {}, users = {}, request = {};

    userService.addFilter = function(key, val, notify) {
      filters[key] = val;
      if (notify) userService.notify();
    };

    userService.setFilters = function(filters2, notify) {
      filters = filters2;
      if (notify) userService.notify();
    };

    userService.setRequest = function (req, notify) {
      request = req;
      if (notify) userService.notify();
    };

    userService.removeFilter = function(key, notify) {
      delete filters[key];
      if (notify) userService.notify();
    };

    userService.filter = function(cb) {
      if (filters.verified === false) {
        delete filters.verified;
      }
      if (filters.is_admin === false) {
        delete filters.is_admin;
      }
      var trequest = angular.copy(request);
      users.length = 0;
      angular.merge(trequest, filters);
      users = User.query(trequest, cb);
    };

    userService.getUsers = function() {
      return users;
    };

    userService.subscribe = function(scope, callback) {
      var handler = $rootScope.$on('users-updated-event', callback);
      scope.$on('$destroy', handler);
    };

    userService.notify = function () {
      $rootScope.$emit('users-updated-event');
    };

    return userService;
  }
]);

var userControllers = angular.module('userControllers', []);

userControllers.controller('UserCtrl', ['$scope', '$routeParams', '$http', '$window', 'gettextCatalog', 'alertService', 'hrinfoService', 'md5', 'config', 'User', 'List', function($scope, $routeParams, $http, $window, gettextCatalog, alertService, hrinfoService, md5, config, User, List) {
  $scope.setAdminAvailable(true);
  $scope.newEmail = {
    type: '',
    email: ''
  };
  $scope.newPhoneNumber = {
    type: '',
    number: ''
  };
  $scope.newLocation = {
    location: {
      id: '',
      name: ''
    }
  };

  $scope.gravatarUrl = '';

  $scope.canEditUser = ($routeParams.userId == $scope.currentUser.id || $scope.currentUser.is_admin);

  $scope.user = User.get({userId: $routeParams.userId}, function(user) {
    var userEmail = md5.createHash(user.email.trim().toLowerCase());
    $scope.gravatarUrl = 'https://secure.gravatar.com/avatar/' + userEmail + '?s=200';
  });

  $scope.countries = [];
  hrinfoService.getCountries().then(function (countries) {
    $scope.countries = countries;
  });

  $scope.regions = [];
  $scope.setRegions = function ($item, $model) {
    $scope.regions = [];
    hrinfoService.getRegions($item.id).then(function (regions) {
      $scope.regions = regions;
    });
  };

  $scope.addItem = function (key) {
    if (!$scope.user[key]) {
      $scope.user[key] = [];
    }
    switch (key) {
      case 'websites':
        $scope.user[key].unshift({url: ''});
        break;
      case 'voips':
        $scope.user[key].unshift({ type: 'Skype', username: '' });
        break;
      case 'phone_numbers':
        $scope.user[key].unshift($scope.newPhoneNumber);
        break;
      case 'emails':
        $scope.user[key].unshift($scope.newEmail);
        break;
      case 'locations':
        $scope.user[key].unshift({country: '', region: ''});
        break;
      case 'job_titles':
        $scope.user[key].unshift('');
        break;
      case 'organizations':
        $scope.user[key].unshift({id: '', name: ''});
        break;
    }
  };

  $scope.dropItem = function (key, index ){
    $scope.user[key].splice(index, 1);
  };

  var hrinfoResponse = function (response) {
    var out = [];
    angular.forEach(response.data.data, function (value, key) {
      this.push({
        id: key,
        name: value
      });
    }, out);
    return out;
  };

  $scope.getOrganization = function(val) {
    return $http.get(config.hrinfoUrl + '/organizations?autocomplete[string]=' + val + '&autocomplete[operator]=STARTS_WITH')
      .then(hrinfoResponse);
  };

  $scope.getDisasters = function(val) {
    return $http.get(config.hrinfoUrl + '/disasters?autocomplete[string]=' + val + '&autocomplete[operator]=STARTS_WITH')
      .then(hrinfoResponse);
  };

  $scope.getLists = function (val) {
    return $http.get(config.apiUrl + 'lists', { params: { where: { name: { contains: val } } } })
      .then(function (response) {
        return response.data;
      });
  };

  $scope.getLocations = function (val) {
    return $http.get(config.hrinfoUrl + '/locations?autocomplete[string]=' + val + '&autocomplete[operator]=STARTS_WITH')
      .then(hrinfoResponse);
  };

  $scope.roles = [];
  $scope.getRoles = function () {
    return hrinfoService.getRoles().then(function (d) {
      $scope.roles = d;
    });
  };

  $scope.phoneNumberTypes = [
    {value: 'Landline', name: 'Landline'},
    {value: 'Mobile', name: 'Mobile'}
  ];

  $scope.emailTypes = [
    {value: 'Work', name: 'Work'},
    {value: 'Personal', name: 'Personal'}
  ];

  $scope.voipTypes = [
    {value: 'Skype', name: 'Skype'},
    {value: 'Google', name: 'Google'}
  ];

  $scope.saveUser = function() {
    $scope.user.$update(function (user, response) {
      //  Update the currentUser item in localStorage if the current user is the one being saved
      if (user.id == $scope.currentUser.id) {
        $scope.setCurrentUser(user);
      }
    });
  };

  $scope.setOrganization = function (data, index) {
    $scope.user.organizations[index] = data;
  };

  // Send claim email
  $scope.sendClaimEmail = function () {
    var alert = alertService.add('warning', gettextCatalog.getString('Are you sure ?'), true, function() {
      $scope.user.claimEmail(function (response) {
        alert.closeConfirm();
        alertService.add('success', gettextCatalog.getString('Claim email sent successfully'));
      }, function (response) {
        alert.closeConfirm();
        alertService.add('danger', gettextCatalog.getString('There was an error sending the claim email'));
      });
    });
  };


  // Export user details to vcard
  $scope.exportVcard = function () {
    var vcard = "BEGIN:VCARD\n" +
      "VERSION:3.0\n" +
      "N:" + $scope.user.family_name + ";" + $scope.user.given_name + ";;;\n" +
      "FN:" + $scope.user.name + "\n";
    if ($scope.user.organization && $scope.user.organization.name) {
      vcard += "ORG:" + $scope.user.organization.name + "\n";
    }
    if ($scope.user.job_title) {
      vcard += "TITLE:" + $scope.user.job_title + "\n";
    }
    if ($scope.user.phone_number) {
      vcard += "TEL;";
      if ($scope.user.phone_number_type) {
        vcard += "TYPE=" + $scope.user.phone_number_type+",";
      }
      vcard += "VOICE:" + $scope.user.phone_number + "\n";
    }
    angular.forEach($scope.user.phone_numbers, function (item) {
      if (item.type && item.number) {
        vcard += "TEL;TYPE=" + item.type + ",VOICE:" + item.number + "\n";
      }
    });
    if ($scope.user.email) {
      vcard += "EMAIL:" + $scope.user.email + "\n";
    }
    angular.forEach($scope.user.emails, function (item) {
      if (item.email) {
        vcard += "EMAIL:" + item.email + "\n";
      }
    });
    vcard += "REV:" + new Date().toISOString() + "\n" +
      "END:VCARD\n";
    window.location.href = 'data:text/vcard;charset=UTF-8,' + encodeURIComponent(vcard);
  }

}]);

userControllers.controller('UserPrefsCtrl', ['$scope', '$location', 'gettextCatalog', 'AuthService', 'alertService', 'User', function ($scope, $location, gettextCatalog, AuthService, alertService, User) {

  $scope.password = {
    old: '',
    new: ''
  };


  $scope.user = User.get({userId: $scope.currentUser.id}, function(user) {
  });

  // Set a new password for the current user
  $scope.savePassword = function(form) {
    $scope.user.old_password = $scope.password.old;
    $scope.user.new_password = $scope.password.new;
    $scope.user.$update(function (user) {
      alertService.add('success', gettextCatalog.getString('Your password was successfully changed.'));
      form.$setPristine();
    }, function (resp) {
      alertService.add('danger', gettextCatalog.getString('There was an error saving your password.'));
      form.$setPristine();
    });
  };

  // Delete current user account
  $scope.deleteAccount = function (lu) {
    var alert = alertService.add('danger', gettextCatalog.getString('Are you sure you want to do this ? You will not be able to access Humanitarian ID anymore.'), true, function() {
      User.delete({id: $scope.user.id}, function (out) {
        alert.closeConfirm();
        alertService.add('success', gettextCatalog.getString('Your account was successfully removed. You are now logged out. Sorry to have you go.'));
        AuthService.logout();
        $scope.removeCurrentUser();
        $location.path('/');
      });
    });
  };

}]);

userControllers.controller('UserNewCtrl', ['$scope', '$location', 'alertService', 'User', 'gettextCatalog', function ($scope, $location, alertService, User, gettextCatalog) {
  $scope.user = new User();
  $scope.user.locale = gettextCatalog.getCurrentLanguage();
  $scope.user.app_verify_url = $location.protocol() + '://' + $location.host() + '/reset_password';
  $scope.currentPath = $location.path();

  $scope.userCreate = function(registerForm) {
    $scope.user.$save(function(user) {
      alertService.add('success', 'The user was successfully created. If you inserted an email address, he/she will receive an email to claim his account. You can now edit the user profile to add more information.');
      registerForm.$setPristine();
      registerForm.$setUntouched();
      $scope.user = new User();
      $location.path('/users/' + user._id);
    }, function (resp) {
      alertService.add('danger', 'There was an error processing your registration.');
      registerForm.$setPristine();
    });
  };
}]);

userControllers.controller('UserRegisterCtrl', ['$scope', '$location', 'alertService', 'User', 'gettextCatalog', function ($scope, $location, alertService, User, gettextCatalog) {
  $scope.user = new User();
  $scope.user.locale = gettextCatalog.getCurrentLanguage();
  $scope.user.app_verify_url = $location.protocol() + '://' + $location.host() + '/verify';
  $scope.currentPath = $location.path();

  $scope.userCreate = function(registerForm) {
    $scope.user.$save(function(user) {
      alertService.add('success', 'Thank you for creating an account. You will soon receive a confirmation email to confirm your account.');
      registerForm.$setPristine();
      registerForm.$setUntouched();
      $scope.user = new User();
    }, function (resp) {
      alertService.add('danger', 'There was an error processing your registration.');
      registerForm.$setPristine();
    });
  };
}]);

userControllers.controller('UsersCtrl', ['$scope', '$routeParams', 'User', function($scope, $routeParams, User) {
}]);

userControllers.controller('KioskCtrl', ['$scope', '$routeParams', '$location', 'gettextCatalog', 'alertService', 'hrinfoService', 'User', 'UserCheckIn', 'List', function ($scope, $routeParams, $location, gettextCatalog, alertService, hrinfoService, User, UserCheckIn, List) {
  $scope.step = 1;
  $scope.user = new User();
  $scope.title = 'Kiosk Registration';
  $scope.lists = new Array();
  $scope.list = {};
  $scope.kioskCreating = false;

  $scope.getLists = function (val) {
    $scope.lists = List.query({'name': val});
  };

  $scope.getOrganizations = function(search) {
    $scope.organizations = List.query({'name': search, 'type': 'organization'});
  };

  $scope.setStep1Clicked = function () {
    $scope.step1clicked = true;
    return true;
  };

  $scope.setStep2Clicked = function () {
    $scope.step2clicked = true;
    return true;
  };

  $scope.gotoStep = function (step) {
    if (step === 2) {
      $scope.title = "Check into " + $scope.list.list.name;
    }
    if (step === 3) {
      $scope.users = User.query({email: $scope.user.email}, function () {
        if ($scope.users.length) {
          $scope.user = $scope.users[0];
        }
      });
    }
    $scope.step = step;
  };

  $scope.countries = [];
  hrinfoService.getCountries().then(function (countries) {
    $scope.countries = countries;
  });

  $scope.regions = [];
  $scope.setRegions = function ($item, $model) {
    $scope.regions = [];
    hrinfoService.getRegions($item.id).then(function (regions) {
      $scope.regions = regions;
    });
  };

  $scope.reinitialize = function() {
    $scope.step = 2;
    $scope.kioskCreating = false;
    $scope.departureDate = '';
    $scope.user = new User();
    $scope.step2clicked = false;
  };

  $scope.checkIn = function (user) {
    var checkinUser = {}, prom = [];
    checkinUser = {
      list: $scope.list.list._id,
      checkoutDate: $scope.departureDate
    };
    // Then do the checkin
    UserCheckIn.save({userId: user._id, listType: $scope.list.list.type + 's'}, checkinUser, function (out) {
      alertService.add('success', 'Thank you for checking in. You will soon receive an email address which will allow you to confirm your account. Please confirm it asap.');
      $scope.reinitialize();
    }, function (resp) {
      alertService.add('danger', 'There was an error checking you in.');
      $scope.reinitialize();
    });
  };

  $scope.kioskCreate = function (kiosk) {
    $scope.kioskCreating = true;
    // If there is no user, create user
    if (!$scope.user._id) {
      $scope.user.locale = gettextCatalog.getCurrentLanguage();
      $scope.user.app_verify_url = $location.protocol() + '://' + $location.host() + '/reset_password';

      $scope.user.$save(function(user) {
        $scope.checkIn(user);
      }, function (resp) {
        alertService.add('danger', 'There was an error registering your account.');
        $scope.reinitialize();
      });
    }
    else {
      $scope.user.$update(function (user) {
        $scope.checkIn($scope.user);
      }, function (resp) {
        alertService.add('danger', 'There was an error updating your account.');
        $scope.reinitialize();
      });
    }
  };

}]);

userControllers.controller('CheckinCtrl', ['$scope', '$routeParams', '$q', 'gettextCatalog', 'config', 'hrinfoService', 'alertService', 'User', 'UserCheckIn', 'List', function($scope, $routeParams, $q, gettextCatalog, config, hrinfoService, alertService, User, UserCheckIn, List) {
  $scope.request = $routeParams;
  $scope.step = 1;

  var queryCallback = function () {
    $scope.lists = List.query({}, function() {
      $scope.lists = $scope.lists.filter(function (list) {
        var out = true, listType = '';
        for (var i = 0, len = config.listTypes.length; i < len; i++) {
          listType = config.listTypes[i] + 's';
          if (!$scope.user[listType]) {
            $scope.user[listType] = new Array();
          }
          for (var j = 0, tlen = $scope.user[listType].length; j < tlen; j++) {
            if ($scope.user[listType][j].list == list._id) {
              out = false;
            }
          }
        }
        return out;
      });
    });
  };

  if (!$routeParams.userId) {
    $scope.user = $scope.currentUser;
    queryCallback();
  }
  else {
    $scope.user = User.get({userId: $routeParams.userId}, queryCallback);
  }

  

  $scope.nextStep = function (step) {
    $scope.step = step;
  };

  $scope.countries = [];
  hrinfoService.getCountries().then(function (countries) {
    $scope.countries = countries;
  });

  $scope.regions = [];
  $scope.setRegions = function ($item, $model) {
    $scope.regions = [];
    hrinfoService.getRegions($item.id).then(function (regions) {
      $scope.regions = regions;
    });
  };

  // Check user in in the lists selected
  $scope.checkin = function () {
    var checked = $scope.lists.filter(function (list) {
      return list.checked;
    });
    var checkinUser = {}, prom = [];
    for (var i = 0, len = checked.length; i < len; i++) {
      checkinUser = {
        list: checked[i]._id,
        checkoutDate: $scope.departureDate
      };
      UserCheckIn.save({userId: $scope.user._id, listType: checked[i].type + 's'}, checkinUser, function (out) {
        if ($scope.currentUser._id == $scope.user._id) {
          $scope.user = User.get({userId: $scope.currentUser._id}, function () {
            $scope.setCurrentUser($scope.user);
            alertService.add('success', gettextCatalog.getString('You were succesfully checked in'));
          });
        }
        else {
          alertService.add('success', $scope.user.name + gettextCatalog.getString(' was successfully checked in'));
        }
      });
    }
  };

}]);

