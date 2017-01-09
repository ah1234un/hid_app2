(function () {
  'use strict';

  angular
    .module('app.notifications')
    .controller('NotificationsCtrl', NotificationsCtrl);

  NotificationsCtrl.$inject = ['$scope', 'notificationsService'];

  function NotificationsCtrl($scope, notificationsService) {
    var limit = 10;
    $scope.itemsPerPage = limit;
    $scope.totalItems = 0;
    $scope.notifications = {};
    $scope.currentPage = 1;

    var params = {
      limit: limit,
      offset: 0,
      sort: '-createdAt'
    };

    $scope.getLink = function (notification) {
      if (notification.params && notification.params.list) {
        return '/lists/' + notification.params.list._id;
      }
      return '/users/' + notification.user;
    };

    $scope.getNotifications = function () {
      params.offset = ($scope.currentPage - 1) * $scope.itemsPerPage;

      notificationsService.getNotifications(params).then(function () {
        $scope.notifications = notificationsService;
        $scope.totalItems = notificationsService.total;

        if (notificationsService.totalUnread > 0 ) {
          notificationsService.markAsRead();
        }
      });

    };

    $scope.getNotifications();

  }
})();
