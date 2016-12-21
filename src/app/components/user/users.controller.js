(function () {
  'use strict';

  angular
    .module('app.user')
    .controller('UsersCtrl', UsersCtrl);

  UsersCtrl.$inject = ['$scope', '$rootScope', '$location', '$window', 'gettextCatalog', 'alertService', 'hrinfoService', 'UserDataService', 'User', 'List'];

  function UsersCtrl($scope, $rootScope, $location, $window, gettextCatalog, alertService, hrinfoService, UserDataService, User, List) {

    $scope.request = {};
    $scope.totalItems = 0;
    $scope.itemsPerPage = 50;
    $scope.currentPage = 1;
    $scope.selectedFilters = {};
    // $scope.searchTerm = $routeParams.name;
    $scope.showAdmin = false;
    var currentSortOrder = $scope.request.name;
    var defaultRequest = {
      limit: $scope.itemsPerPage,
      offset: 0,
      sort: 'name'
    };
    var listInfo =[];

    $scope.request = angular.copy(defaultRequest);

    function getUsers () {
      $scope.request.offset = ($scope.currentPage - 1) * $scope.itemsPerPage;
      var params = angular.extend($scope.request, $scope.filters);
      UserDataService.getUsers(params).then(function (users) {
        $scope.users = users;
        $scope.totalItems = users.headers["x-total-count"];
      });
    }

    $scope.$on('users-export-csv', function (evt) {
      var params = angular.extend($scope.request, $scope.filters);
      var url = User.getCSVUrl(params);
      $window.open(url);
    });

    $scope.$on('populate-list', function (event, listType) {
      $scope.request = angular.extend($scope.request, listType);
      listInfo = listType;
      $scope.showAdmin = listType !== undefined ? true : false;
      getUsers();
    });

    $scope.pageChanged = function () {
      currentSortOrder = $scope.request.sort;
      $scope.request.offset = ($scope.currentPage - 1) * $scope.itemsPerPage;
      getUsers();
    };

    UserDataService.subscribe($scope, function (evt, request) {
      angular.merge($scope.request, request);
      $scope.currentPage = 1;
      getUsers();
    });

    $rootScope.$on('sidebar-closed', function () {
      $scope.selectedFilters = angular.copy($scope.filters);
      $scope.request.sort = currentSortOrder;
    });

    $rootScope.$on('$routeChangeSuccess', function () {
      $scope.resetFilters();
    });

    $scope.filter = function() {
      $scope.filters = angular.copy($scope.selectedFilters);
      $scope.currentPage = 1;
      getUsers();
    };

    $scope.resetFilters = function () {
      $scope.request = angular.copy(defaultRequest);
      if (listInfo) {
        $scope.request = angular.extend($scope.request, listInfo)
      }
      $scope.filters = {};
      $scope.selectedFilters = {};
      $scope.currentPage = 1;
      getUsers();
    }

    //TO DO order asc / desc ?
    $scope.sortList = function (sortby) {
      $scope.request.sort = sortby;
      $scope.currentPage = 1;
      getUsers();
    }

    $scope.setLimit = function (limit) {
      $scope.itemsPerPage = limit
      $scope.request.limit = limit;
      getUsers();
    }

    $scope.operations = List.query({type: 'operation'});

    $scope.bundles = [];
    $scope.getBundles = function(search) {
      $scope.bundles = List.query({type: 'bundle', name: search});
    };

    $scope.disasters = [];
    $scope.getDisasters = function(search) {
      $scope.disasters = List.query({type: 'disaster', name: search});
    };

    $scope.roles = [];
    hrinfoService.getRoles().then(function (d) {
      $scope.roles = d;
    });

    $scope.organizations = [];
    $scope.getOrganizations = function(search) {
      $scope.organizations = List.query({type: 'organization', name: search});
    };

    $scope.countries = [];
    hrinfoService.getCountries().then(function (d) {
      $scope.countries = d;
    });

    $scope.sortBy = [
    {
      label: 'name',
      name: 'Name'
    },
    {
      label: 'job_title',
      name: 'Job title'
    },
    {
      label: 'organization',
      name: 'Organization'
    },
    {
      label: 'verified',
      name: 'Verified'
    }
    ];

    // Delete user account
    $scope.deleteUser = function (user) {
      var alert = alertService.add('danger', gettextCatalog.getString('Are you sure you want to do this ? This user will not be able to access Humanitarian ID anymore.'), true, function() {
        user.$delete(function (out) {
          alert.closeConfirm();
          alertService.add('success', gettextCatalog.getString('The user was successfully deleted.'));
          getUsers();
        });
      });
    }

  }

})();
