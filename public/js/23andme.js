'use strict';

/*global $:true, async:true, JSZip:true*/

$(function () {
  $('.zip').click(function () {
    var self = this;

    var profileId = $(self).data('profile-id');
    var urls = [];

    ['risks', 'carriers', 'drug_responses', 'traits'].forEach(function (url) {
      urls.push({
        name: url + '.csv',
        url: '/23andme/data/' + url + '/' + profileId
      });

      urls.push({
        name: url + '.json',
        url: '/23andme/data/' + url + '/' + profileId  + '/json'
      });
    });

    ['haplogroups', 'ancestry', 'neanderthal'].forEach(function (url) {
      urls.push({
        name: url + '.json',
        url: '/23andme/data/' + url + '/' + profileId  + '/json'
      });
    });

    $(self).next('.download').remove();
    $(self).next('.generating').show();

    async.map(urls, function (url, cbMap) {
      $('#status').append('<li>retrieving ' + url.name + '</li>');

      $.get(url.url, function (data) {
        $('#status').append('<li>retrieved ' + url.name + '</li>');

        cbMap(null, {name: url.name, data: data});
      }, 'text');
    }, function (err, results) {
      console.log(err, results);

      var zip = new JSZip();

      results.forEach(function (result) {
        zip.file(result.name, result.data);
      });

      var blob = zip.generate({type: 'blob'});

      $(self).next('.generating').hide();
      $('#status').hide();

      $('<a>')
        .attr('class', 'download')
        .attr('href', window.URL.createObjectURL(blob))
        .attr('download', '23andme-' + profileId + '.zip')
        .html('Download!')
        .insertAfter(self);
    });

    return false;
  });
});
